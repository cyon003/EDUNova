"""Independent, offline CPU transcription worker. Never writes source media."""
import math
import os
from pathlib import Path
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError

MAX_ATTEMPTS = 3
LEASE_SECONDS = 120
MAX_SEGMENTS = 100000


def now():
    return datetime.now(timezone.utc)


class MediaError(Exception):
    pass


class LeaseLost(Exception):
    pass


def source_path(root, job):
    if job['storage'] not in ('course-videos', 'lesson-resources'):
        raise MediaError('invalid_source')
    name = job['storedName']
    if not name or Path(name).name != name or '\\' in name:
        raise MediaError('invalid_source')
    directory = (Path(root) / job['storage']).resolve()
    if directory.parent != Path(root).resolve():
        raise MediaError('invalid_source')
    path = (directory / name).resolve()
    if path.parent != directory or not path.is_file():
        raise MediaError('missing_source')
    return path


def inspect_audio(path):
    import av
    try:
        with av.open(str(path)) as container:
            if not container.streams.audio:
                raise MediaError('missing_audio')
            if not container.duration or container.duration / av.time_base > int(os.getenv('TRANSCRIPTION_MAX_DURATION_SECONDS', '7200')):
                raise MediaError('invalid_duration')
    except MediaError:
        raise
    except Exception as error:
        raise MediaError('corrupt_media') from error


class Worker:
    def __init__(self, db, root, model=None, revision='test'):
        self.db, self.root, self.model, self.revision = db, root, model, revision
        self.jobs = db.transcription_jobs
        self.segments = db.transcript_segments

    def indexes(self):
        self.jobs.create_index([('course', 1), ('lessonId', 1), ('mediaVersion', 1)], unique=True)
        self.jobs.create_index([('status', 1), ('availableAt', 1), ('leaseUntil', 1)])
        self.segments.create_index([('jobId', 1), ('resultToken', 1), ('index', 1)], unique=True)

    def reconcile(self):
        # A durable intent committed with the lesson closes the save/enqueue crash gap.
        for course in self.db.courses.find({'lessons.transcriptionSource.mediaVersion': {'$exists': True}}, {'lessons': 1}):
            for lesson in course.get('lessons', []):
                source = lesson.get('transcriptionSource') or {}
                if not source.get('mediaVersion') or lesson.get('primaryMediaRemoved'):
                    continue
                if (lesson.get('primaryMedia') or {}).get('storedName') != source.get('storedName'):
                    continue
                key = dict(course=course['_id'], lessonId=lesson['_id'], mediaVersion=source['mediaVersion'])
                try:
                    self.jobs.update_one(key, {'$setOnInsert': {**source, 'status': 'queued', 'attempts': 0, 'availableAt': now(), 'createdAt': now()}}, upsert=True)
                except DuplicateKeyError:
                    pass

    def current(self, job):
        course = self.db.courses.find_one({'_id': job['course']}, {'lessons': 1})
        for lesson in (course or {}).get('lessons', []):
            if lesson['_id'] == job['lessonId']:
                source = lesson.get('transcriptionSource') or {}
                media = lesson.get('primaryMedia') or {}
                return (not lesson.get('primaryMediaRemoved') and source.get('mediaVersion') == job['mediaVersion']
                        and source.get('storedName') == job['storedName'] == media.get('storedName')
                        and source.get('storage') == job['storage'] == media.get('storage'))
        return False

    def claim(self, instant=None):
        instant = instant or now()
        # A crash on the final attempt must terminate rather than stay processing forever.
        self.jobs.update_many({'status': 'processing', 'leaseUntil': {'$lte': instant}, 'attempts': {'$gte': MAX_ATTEMPTS}},
                             {'$set': {'status': 'failed', 'errorCode': 'lease_expired', 'updatedAt': instant}})
        return self.jobs.find_one_and_update({
            'attempts': {'$lt': MAX_ATTEMPTS}, '$or': [
                {'status': 'queued', 'availableAt': {'$lte': instant}},
                {'status': 'processing', 'leaseUntil': {'$lte': instant}}]},
            {'$set': {'status': 'processing', 'leaseToken': uuid.uuid4().hex,
                      'leaseUntil': instant + timedelta(seconds=LEASE_SECONDS), 'updatedAt': instant}, '$inc': {'attempts': 1}},
            sort=[('availableAt', 1)], return_document=ReturnDocument.AFTER)

    def owned(self, job):
        return {'_id': job['_id'], 'status': 'processing', 'leaseToken': job['leaseToken'], 'leaseUntil': {'$gt': now()}}

    def renew(self, job):
        return self.jobs.update_one(self.owned(job), {'$set': {'leaseUntil': now() + timedelta(seconds=LEASE_SECONDS)}}).matched_count == 1

    def fail(self, job, code, permanent=False):
        self.jobs.update_one(self.owned(job), {'$set': {
            'status': 'failed' if permanent or job['attempts'] >= MAX_ATTEMPTS else 'queued',
            'errorCode': code, 'availableAt': now() + timedelta(seconds=30 * job['attempts']), 'updatedAt': now()}})

    def publish(self, job, count, language):
        # Results are immutable per attempt. Only a live lease may publish its pointer.
        if not self.current(job):
            self.jobs.update_one(self.owned(job), {'$set': {'status': 'superseded'}})
            return False
        return self.jobs.update_one(self.owned(job), {'$set': {
            'status': 'completed', 'resultToken': job['leaseToken'], 'segmentCount': count,
            'language': language, 'modelRevision': self.revision, 'completedAt': now(),
            'updatedAt': now(), 'errorCode': None}}).matched_count == 1

    def process(self, job):
        stop, lost = threading.Event(), threading.Event()
        def heartbeat():
            while not stop.wait(LEASE_SECONDS / 3):
                try:
                    if not self.renew(job):
                        lost.set()
                        return
                except Exception:
                    lost.set()
                    return
        thread = threading.Thread(target=heartbeat, daemon=True)
        thread.start()
        try:
            if not self.current(job):
                self.jobs.update_one(self.owned(job), {'$set': {'status': 'superseded'}})
                return
            path = source_path(self.root, job)
            inspect_audio(path)
            segments, info = self.model.transcribe(str(path), beam_size=5, vad_filter=True)
            count, previous = 0, 0.0
            for segment in segments:
                if lost.is_set():
                    raise LeaseLost()
                start, end, text = float(segment.start), float(segment.end), segment.text.strip()
                if not text:
                    continue
                if (not all(map(math.isfinite, (start, end))) or start < previous or end <= start
                        or end > 86400 or len(text) > 20000 or count >= MAX_SEGMENTS):
                    raise MediaError('invalid_segments')
                self.segments.insert_one({'jobId': job['_id'], 'resultToken': job['leaseToken'], 'index': count,
                                          'startTimeSeconds': start, 'endTimeSeconds': end, 'text': text})
                previous, count = end, count + 1
            if not count:
                raise MediaError('no_speech')
            self.publish(job, count, info.language)
        except LeaseLost:
            pass
        except MediaError as error:
            self.fail(job, str(error), permanent=True)
        except Exception:
            self.fail(job, 'transcription_failed')
        finally:
            stop.set()
            thread.join()


def main():
    # Enforce offline operation before importing the inference libraries.
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    model_path = Path(os.environ['TRANSCRIPTION_MODEL_PATH']).resolve()
    if not model_path.is_dir() or not (model_path / 'model.bin').is_file():
        raise SystemExit('Provision a local CTranslate2 Whisper model first')
    revision = os.environ['TRANSCRIPTION_MODEL_REVISION']
    root = Path(os.environ['UPLOAD_ROOT']).resolve(strict=True)
    from faster_whisper import WhisperModel
    model = WhisperModel(str(model_path), device='cpu', compute_type='int8',
                         cpu_threads=int(os.getenv('TRANSCRIPTION_CPU_THREADS', '2')), num_workers=1, local_files_only=True)
    client = MongoClient(os.environ['MONGO_URI'], serverSelectionTimeoutMS=10000)
    worker = Worker(client[os.environ['MONGO_DB_NAME']], root, model, revision)
    worker.indexes()
    last_reconcile = 0
    while True:
        try:
            if time.monotonic() - last_reconcile > 30:
                worker.reconcile()
                last_reconcile = time.monotonic()
            job = worker.claim()
            if job:
                worker.process(job)
            else:
                time.sleep(2)
        except Exception:
            print('Worker database operation failed; retrying', flush=True)
            time.sleep(5)


if __name__ == '__main__':
    main()

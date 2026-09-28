"""Asynchronous local topic suggestions; reuses the transcription lease protocol."""
import os
from pathlib import Path
import threading
import time
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from worker import Worker, now, LEASE_SECONDS
from topic_generation import generate_topics, TranscriptError, ALGORITHM_VERSION, PARAMETERS


def load_topic_model(path, revision=None):
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['TOKENIZERS_PARALLELISM'] = 'false'
    path = Path(path).resolve(strict=True)
    if not path.is_dir() or not (path / 'modules.json').is_file():
        raise ValueError('Provision a complete local Sentence Transformers model first')
    if revision is not None and (path / 'REVISION').read_text().strip() != revision:
        raise ValueError('TOPIC_MODEL_REVISION must match the provisioned REVISION file')
    import torch
    from sentence_transformers import SentenceTransformer
    torch.set_num_threads(2)
    return SentenceTransformer(str(path), device='cpu', local_files_only=True, trust_remote_code=False)


class TopicWorker(Worker):
    def __init__(self, db, model, revision):
        super().__init__(db, None, model, revision)
        self.jobs = db.topic_suggestions

    def indexes(self):
        self.jobs.create_index([('transcriptionJobId', 1), ('transcriptResultToken', 1), ('algorithmVersion', 1), ('modelRevision', 1)], unique=True)
        self.jobs.create_index([('status', 1), ('availableAt', 1), ('leaseUntil', 1)])
        self.jobs.create_index([('course', 1), ('lessonId', 1), ('mediaVersion', 1)])

    def current(self, job):
        return super().current(job) and self.db.transcription_jobs.find_one({
            '_id': job['transcriptionJobId'], 'status': 'completed',
            'resultToken': job['transcriptResultToken'], 'mediaVersion': job['mediaVersion']}) is not None

    def reconcile(self):
        for transcript in self.db.transcription_jobs.find({'status': 'completed', 'resultToken': {'$type': 'string'}}):
            job = {key: transcript[key] for key in ('course', 'lessonId', 'mediaVersion', 'storage', 'storedName')}
            key = {'transcriptionJobId': transcript['_id'], 'transcriptResultToken': transcript['resultToken'],
                   'algorithmVersion': ALGORITHM_VERSION, 'modelRevision': self.revision}
            if not self.current({**job, **key}):
                continue
            try:
                self.jobs.update_one(key, {'$setOnInsert': {**job, 'status': 'queued', 'attempts': 0,
                    'reviewStatus': 'pending', 'reviewRevision': 0, 'availableAt': now(), 'createdAt': now(),
                    'provenance': {'source': 'local_transcript', 'embeddingModel': 'sentence-transformers/all-MiniLM-L6-v2',
                        'titleMethod': 'extractive_phrase_frequency_and_semantic_relevance', 'parameters': PARAMETERS,
                        'transcriptionModelRevision': transcript.get('modelRevision'), 'language': transcript.get('language')}}}, upsert=True)
            except DuplicateKeyError:
                pass

    def publish_topics(self, job, topics, diagnostics):
        def publish(session):
            if not self.jobs.find_one(self.owned(job), session=session):
                return False
            # Writes fence replacement/deletion and transcript regeneration. A
            # concurrent source write forces transaction retry and revalidation.
            course = self.db.courses.update_one({'_id': job['course'], 'lessons': {'$elemMatch': {
                '_id': job['lessonId'], 'primaryMediaRemoved': {'$ne': True},
                'transcriptionSource.mediaVersion': job['mediaVersion'],
                'transcriptionSource.storage': job['storage'],
                'transcriptionSource.storedName': job['storedName'],
                'primaryMedia.storage': job['storage'], 'primaryMedia.storedName': job['storedName']}}},
                {'$inc': {'topicSuggestionRevision': 1}}, session=session)
            transcript = self.db.transcription_jobs.update_one({
                '_id': job['transcriptionJobId'], 'status': 'completed',
                'resultToken': job['transcriptResultToken'], 'mediaVersion': job['mediaVersion']},
                {'$inc': {'__v': 1}}, session=session)
            if not course.matched_count or not transcript.matched_count:
                self.jobs.update_one(self.owned(job), {'$set': {'status': 'superseded'}}, session=session)
                return False
            return self.jobs.update_one(self.owned(job), {'$set': {'status': 'completed', 'generatedTopics': topics,
                'draftTopics': topics, 'diagnostics': diagnostics, 'completedAt': now(), 'updatedAt': now(), 'errorCode': None}},
                session=session).matched_count == 1
        with self.db.client.start_session() as session:
            return session.with_transaction(publish)

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
            transcript = self.db.transcription_jobs.find_one({'_id': job['transcriptionJobId']})
            count = transcript.get('segmentCount', 0)
            if not 0 <= count <= 100000:
                raise TranscriptError('transcript_too_large')
            segments = list(self.segments.find({'jobId': job['transcriptionJobId'], 'resultToken': job['transcriptResultToken']}).sort('index', 1).limit(100001))
            if len(segments) != count or any(s['index'] != i for i, s in enumerate(segments)):
                raise TranscriptError('incomplete_transcript')
            topics, diagnostics = generate_topics(segments, self.model)
            if not lost.is_set():
                self.publish_topics(job, topics, diagnostics)
        except TranscriptError as error:
            self.fail(job, str(error), permanent=True)
        except Exception:
            self.fail(job, 'topic_generation_failed')
        finally:
            stop.set()
            thread.join()


def main():
    model = load_topic_model(os.environ['TOPIC_MODEL_PATH'], os.environ['TOPIC_MODEL_REVISION'])
    client = MongoClient(os.environ['MONGO_URI'], serverSelectionTimeoutMS=10000)
    worker = TopicWorker(client[os.environ['MONGO_DB_NAME']], model, os.environ['TOPIC_MODEL_REVISION'])
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
            print('Topic worker database operation failed; retrying', flush=True)
            time.sleep(5)


if __name__ == '__main__':
    main()

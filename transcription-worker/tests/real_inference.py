"""Opt-in real-model smoke test. Starts its own disposable MongoDB; no app DB access."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import resource
import socket
import subprocess
import sys
import tempfile
import time
import uuid

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--assert-network-blocked', action='store_true')
    parser.add_argument('--max-video-seconds', type=float, default=600)
    parser.add_argument('--topic-model', type=Path)
    parser.add_argument('--topic-revision')
    parser.add_argument('--topic-python', type=Path)
    parser.add_argument('--expected-segments', type=int)
    args = parser.parse_args()
    video, model_path = args.video.resolve(strict=True), args.model.resolve(strict=True)
    if video.parent.name not in ('course-videos', 'lesson-resources'):
        parser.error('Video must reside in a local upload storage directory')
    if args.assert_network_blocked:
        # A routable numeric destination avoids mistaking a DNS error for isolation.
        try:
            with socket.create_connection(('1.1.1.1', 443), timeout=3):
                raise RuntimeError('Outbound network is available; isolation test refused')
        except PermissionError:
            pass
        # Timeout/refusal is not proof of an OS-enforced network block.
    from pymongo import MongoClient
    from bson import ObjectId
    from faster_whisper import WhisperModel
    import av
    from worker import Worker
    before = digest(video)
    with av.open(str(video)) as container:
        duration = container.duration / av.time_base if container.duration else None
        assert container.streams.audio, 'Selected video has no audio'
        assert duration and duration <= args.max_video_seconds, 'Video exceeds the explicit test duration limit'
    with tempfile.TemporaryDirectory(prefix='edunova-real-transcription-') as temp:
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        with open(Path(temp) / 'mongo.log', 'w') as log:
            mongo = subprocess.Popen(['mongod', '--dbpath', temp, '--bind_ip', '127.0.0.1', '--port', str(port), '--replSet', 'offlineSmoke', '--quiet'], stdout=log, stderr=log)
            client = MongoClient(f'mongodb://127.0.0.1:{port}/?directConnection=true', serverSelectionTimeoutMS=500)
            try:
                for attempt in range(40):
                    try:
                        client.admin.command('ping')
                        break
                    except Exception:
                        if mongo.poll() is not None or attempt == 39:
                            raise RuntimeError('Disposable MongoDB failed to start')
                        time.sleep(0.25)
                client.admin.command({'replSetInitiate': {'_id': 'offlineSmoke', 'members': [{'_id': 0, 'host': f'127.0.0.1:{port}'}]}})
                for attempt in range(100):
                    if client.admin.command('hello').get('isWritablePrimary'):
                        break
                    if attempt == 99:
                        raise RuntimeError('Disposable replica set has no primary')
                    time.sleep(0.1)
                db = client['offline_smoke_' + uuid.uuid4().hex]
                source = dict(mediaVersion=uuid.uuid4().hex, storage=video.parent.name, storedName=video.name)
                lesson = dict(_id=ObjectId(), title='Disposable smoke test', primaryMedia=source.copy(), transcriptionSource=source.copy(), transcript='Manual text must remain unchanged', topics=[dict(title='Manual topic', startTimeSeconds=0, endTimeSeconds=duration)])
                course = dict(_id=ObjectId(), lessons=[lesson])
                db.courses.insert_one(course)
                start = time.perf_counter()
                model = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=2, num_workers=1, local_files_only=True)
                loaded = time.perf_counter()
                worker = Worker(db, video.parent.parent, model, args.revision)
                worker.indexes()
                worker.reconcile()
                job = worker.claim()
                worker.process(job)
                finished = time.perf_counter()
                saved = db.transcription_jobs.find_one({'_id': job['_id']})
                assert saved['status'] == 'completed', saved.get('errorCode', saved['status'])
                segments = list(db.transcript_segments.find({'jobId': job['_id'], 'resultToken': saved['resultToken']}).sort('index', 1))
                assert len(segments) == saved['segmentCount'] > 0
                if args.expected_segments is not None:
                    assert len(segments) == args.expected_segments
                topic_result = None
                if args.topic_model:
                    assert args.topic_revision and args.topic_python, 'Supply topic revision and isolated Python'
                    # Keep the venv launcher path: resolve() follows its symlink
                    # to system Python and silently loses the isolated packages.
                    command = [str(args.topic_python.absolute()), '-B', str(Path(__file__).with_name('real_topics.py')),
                        '--uri', f'mongodb://127.0.0.1:{port}', '--database', db.name,
                        '--model', str(args.topic_model.resolve()), '--revision', args.topic_revision]
                    completed = subprocess.run(command, capture_output=True, text=True)
                    if completed.returncode:
                        raise RuntimeError(f'Topic subprocess failed:\n{completed.stderr}')
                    topic_result = json.loads(completed.stdout)
                previous = 0
                for index, segment in enumerate(segments):
                    assert segment['index'] == index
                    assert previous <= segment['startTimeSeconds'] < segment['endTimeSeconds'] <= duration + 0.1
                    assert segment['text'].strip()
                    previous = segment['endTimeSeconds']
                saved_course = db.courses.find_one({'_id': course['_id']})
                if args.topic_model:
                    assert saved_course.pop('topicSuggestionRevision') == 1
                assert saved_course == course
                assert digest(video) == before, 'Original video changed'
                assert worker.claim() is None, 'Unexpected duplicate job'
                print(json.dumps(dict(video=str(video), video_sha256=before, duration_seconds=duration,
                    model_revision=args.revision, segment_count=len(segments), language=saved['language'],
                    topic_generation=topic_result,
                    model_load_seconds=round(loaded-start, 3), processing_seconds=round(finished-loaded, 3),
                    total_seconds=round(finished-start, 3),
                    peak_process_memory_bytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024),
                    mongo_persistence_verified=True, source_unchanged=True, manual_content_unchanged=True,
                    os_network_block_verified=args.assert_network_blocked,
                    preview=[{key:s[key] for key in ('index','startTimeSeconds','endTimeSeconds','text')} for s in segments[:3]]), indent=2))
            finally:
                client.close()
                mongo.terminate()
                try:
                    mongo.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    mongo.kill()
                    mongo.wait()


if __name__ == '__main__':
    main()

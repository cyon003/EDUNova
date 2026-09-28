"""Invoked by real_inference.py against that test's ephemeral local MongoDB only."""
import argparse
import json
from pathlib import Path
import resource
import sys
import time
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient
from topic_worker import TopicWorker, load_topic_model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--uri', required=True)
    parser.add_argument('--database', required=True)
    parser.add_argument('--model', required=True)
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    parsed = urlparse(args.uri)
    if parsed.hostname != '127.0.0.1' or parsed.username or not args.database.startswith('offline_smoke_'):
        parser.error('Only the disposable real-inference database is allowed')
    client = MongoClient(args.uri, serverSelectionTimeoutMS=3000)
    try:
        db = client[args.database]
        courses_before = list(db.courses.find({}))
        assert len(courses_before) == 1 and courses_before[0]['lessons'][0]['title'] == 'Disposable smoke test'
        start = time.perf_counter()
        model = load_topic_model(args.model, args.revision)
        loaded = time.perf_counter()
        worker = TopicWorker(db, model, args.revision)
        worker.indexes()
        worker.reconcile()
        worker.reconcile()
        assert db.topic_suggestions.count_documents({}) == 1
        job = worker.claim()
        worker.process(job)
        finish = time.perf_counter()
        result = db.topic_suggestions.find_one({'_id': job['_id']})
        assert result['status'] == 'completed', result.get('errorCode')
        courses_after = list(db.courses.find({}))
        for course in courses_after:
            assert course.pop('topicSuggestionRevision') == 1
        assert courses_after == courses_before
        topics = result['generatedTopics']
        assert 1 <= len(topics) <= 50
        previous = 0
        evidence = []
        segments = list(db.transcript_segments.find({'jobId':job['transcriptionJobId'], 'resultToken':job['transcriptResultToken']}).sort('index', 1))
        for topic in topics:
            assert previous <= topic['startTimeSeconds'] < topic['endTimeSeconds'] <= segments[-1]['endTimeSeconds']
            previous = topic['endTimeSeconds']
            assert topic['title'].strip() and len(topic['title']) <= 200
            members = [s for s in segments if topic['startTimeSeconds'] <= s['startTimeSeconds'] < topic['endTimeSeconds']]
            evidence.append({'topic':topic, 'openingExcerpt':' '.join(s['text'] for s in members[:3]),
                             'closingExcerpt':' '.join(s['text'] for s in members[-2:]),
                             'transcript':' '.join(s['text'] for s in members)})
        print(json.dumps({'model_revision':args.revision,'model_load_seconds':round(loaded-start,3),
            'algorithm_version': result['algorithmVersion'],
            'processing_seconds':round(finish-loaded,3), 'peak_process_memory_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024),
            'topic_count':len(topics), 'diagnostics':result['diagnostics'], 'topics_and_evidence':evidence,
            'manual_content_unchanged':True, 'mongo_persistence_verified':True}, indent=2))
    finally:
        client.close()


if __name__ == '__main__':
    main()

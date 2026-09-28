import os
from pathlib import Path
import sys
import unittest
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from topic_generation import generate_topics, phrases, TranscriptError
from topic_worker import TopicWorker
from worker import now


class Encoder:
    def encode(self, texts, **kwargs):
        return np.array([[1, 0] if 'sorting' in text else [0, 1] for text in texts])


def segments(count=20, seconds=15):
    return [{'index': i, 'startTimeSeconds': i*seconds, 'endTimeSeconds': (i+1)*seconds,
             'text': ('Sorting arrays with insertion sorting.' if i < count//2 else 'Binary trees and searching nodes.')} for i in range(count)]


class SegmentationTests(unittest.TestCase):
    def test_titles_keep_subject_phrases_and_exclude_speech_filler(self):
        candidates = phrases("Don't know, cannot take. Writing an algorithm takes one unit of time.")
        self.assertIn(('writing', 'an', 'algorithm'), candidates)
        self.assertIn(('unit', 'of', 'time'), candidates)
        self.assertFalse(any('know' in p or 'cannot' in p or 'take' in p for p in candidates))

    def check_ranges(self, topics):
        previous = 0
        for topic in topics:
            self.assertLessEqual(previous, topic['startTimeSeconds'])
            self.assertLess(topic['startTimeSeconds'], topic['endTimeSeconds'])
            self.assertTrue(0 < len(topic['title']) <= 200)
            previous = topic['endTimeSeconds']

    def test_semantic_boundary_chronological_and_deterministic(self):
        topics, diagnostics = generate_topics(segments(), Encoder())
        self.check_ranges(topics)
        self.assertEqual(len(topics), 2)
        self.assertEqual(topics[1]['startTimeSeconds'], 150)
        self.assertIn('sorting', topics[0]['title'].lower())
        self.assertIn('trees', topics[1]['title'].lower())
        self.assertEqual(generate_topics(segments(), Encoder()), (topics, diagnostics))

    def test_short_single_topic_and_long_fragmentation_cap(self):
        self.assertEqual(len(generate_topics(segments(2), Encoder())[0]), 1)
        single = segments(40)
        for s in single: s['text'] = 'Sorting arrays with insertion sorting.'
        self.assertEqual(len(generate_topics(single, Encoder())[0]), 1)
        long = segments(1000)
        for i, s in enumerate(long): s['text'] = 'sorting arrays' if (i//5)%2 else 'binary trees'
        topics, _ = generate_topics(long, Encoder())
        self.check_ranges(topics)
        self.assertLessEqual(len(topics), 50)
        self.assertTrue(all(t['endTimeSeconds']-t['startTimeSeconds'] >= 60 for t in topics))

    def test_empty_noisy_and_invalid(self):
        self.assertEqual(generate_topics([], Encoder())[0], [])
        self.assertEqual(generate_topics([{'startTimeSeconds':0,'endTimeSeconds':10,'text':'[Music] okay um'}], Encoder())[0], [])
        self.assertEqual(generate_topics([{'startTimeSeconds':0,'endTimeSeconds':10,'text':'[Music] okay'}], Encoder())[0], [])
        for rows in [[{'startTimeSeconds':0,'endTimeSeconds':float('nan'),'text':'words'}], list(reversed(segments()))]:
            with self.assertRaises(TranscriptError): generate_topics(rows, Encoder())

    def test_invalid_model_output_and_missing_local_weights(self):
        from topic_worker import load_topic_model
        with self.assertRaises((FileNotFoundError, ValueError)):
            load_topic_model('/nonexistent/all-MiniLM-L6-v2')
        for value in ([[0, 0]], [[float('nan'), 1]], [[]], [1]):
            class Invalid:
                def encode(self, *args, **kwargs): return value
            with self.assertRaises(RuntimeError):
                generate_topics(segments(1), Invalid())
        with self.assertRaises(TranscriptError):
            generate_topics([{'text': None}], Encoder())


@unittest.skipUnless(os.getenv('TOPIC_TEST_MONGO_URI'), 'disposable MongoDB runner required')
class TopicWorkerTests(unittest.TestCase):
    def setUp(self):
        from pymongo import MongoClient
        from bson import ObjectId
        from urllib.parse import urlparse
        parsed = urlparse(os.environ['TOPIC_TEST_MONGO_URI'])
        if parsed.hostname != '127.0.0.1' or parsed.username or parsed.path != '/topic_api_test':
            raise RuntimeError('Use only the disposable topic API test runner')
        self.client = MongoClient(os.environ['TOPIC_TEST_MONGO_URI'])
        self.db = self.client.topic_worker_test
        self.addCleanup(self.client.close)
        for collection in ('courses','transcription_jobs','transcript_segments','topic_suggestions'):
            self.db[collection].delete_many({})
        self.course, self.lesson, self.transcript = ObjectId(), ObjectId(), ObjectId()
        source = dict(mediaVersion='v1', storage='course-videos', storedName='test.mp4')
        self.original = {'_id':self.course, 'lessons':[{'_id':self.lesson, 'primaryMedia':source, 'transcriptionSource':source, 'transcript':'manual', 'topics':[{'_id':ObjectId(),'title':'Manual','startTimeSeconds':0,'endTimeSeconds':10}]}]}
        self.db.courses.insert_one(self.original)
        self.db.transcription_jobs.insert_one({'_id':self.transcript,'course':self.course,'lessonId':self.lesson,**source,'status':'completed','resultToken':'r1','segmentCount':20})
        self.db.transcript_segments.insert_many([{**s,'jobId':self.transcript,'resultToken':'r1'} for s in segments()])
        self.worker = TopicWorker(self.db, Encoder(), 'model-v1')
        self.worker.indexes()
        self.worker.reconcile()

    def test_duplicates_claim_and_manual_preservation(self):
        with ThreadPoolExecutor(4) as pool:
            list(pool.map(lambda _:self.worker.reconcile(), range(8)))
            claims = list(pool.map(lambda _:self.worker.claim(), range(8)))
        self.assertEqual(self.db.topic_suggestions.count_documents({}), 1)
        job = next(j for j in claims if j)
        self.assertEqual(sum(j is not None for j in claims), 1)
        self.worker.process(job)
        self.assertEqual(self.db.topic_suggestions.find_one({})['status'], 'completed')
        saved = self.db.courses.find_one({})
        self.assertEqual(saved.pop('topicSuggestionRevision'), 1)
        self.assertEqual(saved, self.original)

    def test_model_failure_retries_and_restart(self):
        class Broken:
            def encode(self, *args, **kwargs): raise RuntimeError('test model failed')
        self.worker.model = Broken()
        job = self.worker.claim()
        self.worker.process(job)
        self.assertEqual(self.db.topic_suggestions.find_one({})['status'], 'queued')
        self.db.topic_suggestions.update_one({}, {'$set':{'availableAt':now()-timedelta(seconds=1)}})
        old = self.worker.claim()
        self.db.topic_suggestions.update_one({}, {'$set':{'leaseUntil':now()-timedelta(seconds=1)}})
        new = self.worker.claim()
        self.assertEqual(new['attempts'], 3)
        self.assertFalse(self.worker.publish_topics(old, [], {}))
        self.worker.process(new)
        self.assertEqual(self.db.topic_suggestions.find_one({})['status'], 'failed')
        self.assertIsNone(self.worker.claim())

    def test_replacement_and_regeneration_during_processing(self):
        for field, value in [('mediaVersion','v2'), ('resultToken','r2')]:
            with self.subTest(field=field):
                job = self.worker.claim()
                if field == 'mediaVersion':
                    self.db.courses.update_one({}, {'$set':{'lessons.0.transcriptionSource.mediaVersion':value}})
                else:
                    self.db.transcription_jobs.update_one({}, {'$set':{field:value}})
                self.assertFalse(self.worker.publish_topics(job, [], {}))
                self.assertEqual(self.db.topic_suggestions.find_one({'_id':job['_id']})['status'], 'superseded')
                self.db.courses.update_one({}, {'$set':{'lessons.0.transcriptionSource.mediaVersion':'v1'}})
                if field == 'mediaVersion':
                    self.db.topic_suggestions.update_one({}, {'$set':{'status':'queued','availableAt':now()}})
        self.worker.reconcile()
        self.assertEqual(self.db.topic_suggestions.count_documents({}), 2)

    def test_empty_transcript_completes_without_invented_topics(self):
        self.db.transcript_segments.delete_many({})
        self.db.transcription_jobs.update_one({}, {'$set':{'segmentCount':0}})
        self.worker.process(self.worker.claim())
        saved = self.db.topic_suggestions.find_one({})
        self.assertEqual(saved['status'], 'completed')
        self.assertEqual(saved['generatedTopics'], [])

    def test_retry_recovers_and_replacement_inside_encode_is_fenced(self):
        class OnceBroken(Encoder):
            calls = 0
            def encode(self, *args, **kwargs):
                self.calls += 1
                if self.calls == 1:
                    raise RuntimeError('temporary model failure')
                return super().encode(*args, **kwargs)
        self.worker.model = OnceBroken()
        self.worker.process(self.worker.claim())
        self.db.topic_suggestions.update_one({}, {'$set': {'availableAt': now()}})
        self.worker.process(self.worker.claim())
        saved = self.db.topic_suggestions.find_one({})
        self.assertEqual(saved['status'], 'completed')
        self.assertEqual(saved['attempts'], 2)
        self.db.transcription_jobs.update_one({}, {'$set': {'resultToken': 'r2'}})
        self.db.transcript_segments.update_many({}, {'$set': {'resultToken': 'r2'}})
        self.worker.reconcile()
        db = self.db
        class Replacing(Encoder):
            def encode(self, *args, **kwargs):
                db.courses.update_one({}, {'$set': {'lessons.0.transcriptionSource.mediaVersion': 'v2'}})
                return super().encode(*args, **kwargs)
        self.worker.model = Replacing()
        job = self.worker.claim()
        self.worker.process(job)
        self.assertEqual(self.db.topic_suggestions.find_one({'_id': job['_id']})['status'], 'superseded')

    def test_replacement_after_publication_snapshot_retries_transaction(self):
        from unittest.mock import patch
        from pymongo.collection import Collection
        original = Collection.update_one
        db, changed = self.db, []
        def racing_update(collection, *args, **kwargs):
            if collection.name == 'courses' and kwargs.get('session') and not changed:
                changed.append(True)
                original(db.courses, {'_id': self.course},
                         {'$set': {'lessons.0.transcriptionSource.mediaVersion': 'v2'}})
            return original(collection, *args, **kwargs)
        job = self.worker.claim()
        with patch.object(Collection, 'update_one', racing_update):
            self.assertFalse(self.worker.publish_topics(job, [], {}))
        self.assertTrue(changed)
        self.assertEqual(self.db.topic_suggestions.find_one({})['status'], 'superseded')

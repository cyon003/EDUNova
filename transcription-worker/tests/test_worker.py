import os
import sys
import tempfile
import unittest
from pathlib import Path
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worker import Worker, now, MediaError, source_path, inspect_audio
from pymongo import MongoClient
from bson import ObjectId


class WorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = MongoClient(os.environ['TRANSCRIPTION_TEST_MONGO_URI'])
        cls.db = cls.client['transcription_worker_test']

    def setUp(self):
        self.db.transcription_jobs.delete_many({})
        self.db.transcript_segments.delete_many({})
        self.db.courses.delete_many({})
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'course-videos').mkdir()
        (self.root / 'course-videos' / 'video.mp4').write_bytes(b'unchanged fixture')
        self.source = dict(mediaVersion='v1', storage='course-videos', storedName='video.mp4')
        self.course, self.lesson = ObjectId(), ObjectId()
        self.db.courses.insert_one({'_id': self.course, 'lessons': [{'_id': self.lesson, 'primaryMedia': self.source, 'transcriptionSource': self.source}]})
        self.worker = Worker(self.db, self.root)
        self.worker.indexes()
        self.worker.reconcile()

    def test_duplicate_jobs_and_atomic_claim(self):
        with ThreadPoolExecutor(4) as pool:
            list(pool.map(lambda _: self.worker.reconcile(), range(8)))
            claims = list(pool.map(lambda _: self.worker.claim(), range(8)))
        self.assertEqual(self.db.transcription_jobs.count_documents({}), 1)
        self.assertEqual(sum(job is not None for job in claims), 1)

    def test_restart_reclaims_and_fences_old_attempt(self):
        old = self.worker.claim()
        self.db.transcription_jobs.update_one({'_id': old['_id']}, {'$set': {'leaseUntil': now() - timedelta(seconds=1)}})
        restarted = Worker(self.db, self.root)
        new = restarted.claim()
        self.assertEqual(new['attempts'], 2)
        self.assertFalse(self.worker.renew(old))
        self.assertFalse(self.worker.publish(old, 0, 'en'))
        self.assertTrue(restarted.publish(new, 0, 'en'))

    def test_bounded_retries_and_final_crash(self):
        for attempt in range(1, 4):
            job = self.worker.claim()
            self.assertEqual(job['attempts'], attempt)
            self.worker.fail(job, 'transcription_failed')
            self.db.transcription_jobs.update_one({'_id': job['_id']}, {'$set': {'availableAt': now() - timedelta(seconds=1)}})
        self.assertIsNone(self.worker.claim())
        self.assertEqual(self.db.transcription_jobs.find_one({})['status'], 'failed')
        self.db.transcription_jobs.update_one({}, {'$set': {'status': 'processing', 'leaseUntil': now() - timedelta(seconds=1)}})
        self.assertIsNone(self.worker.claim())
        self.assertEqual(self.db.transcription_jobs.find_one({})['errorCode'], 'lease_expired')

    def test_media_replacement_and_missing_enqueue_recovery(self):
        old = self.worker.claim()
        self.db.courses.update_one({'_id': self.course}, {'$set': {'lessons.0.transcriptionSource.mediaVersion': 'v2'}})
        self.worker.reconcile()
        self.assertEqual(self.db.transcription_jobs.count_documents({}), 2)
        self.assertFalse(self.worker.publish(old, 1, 'en'))
        self.assertEqual(self.db.transcription_jobs.find_one({'_id': old['_id']})['status'], 'superseded')

    def test_corrupt_video_and_missing_audio(self):
        for code in ('corrupt_media', 'missing_audio'):
            with self.subTest(code=code):
                self.db.transcription_jobs.update_one({}, {'$set': {'status': 'queued', 'attempts': 0, 'availableAt': now()}})
                job = self.worker.claim()
                with patch('worker.inspect_audio', side_effect=MediaError(code)):
                    self.worker.process(job)
                saved = self.db.transcription_jobs.find_one({})
                self.assertEqual(saved['status'], 'failed')
                self.assertEqual(saved['errorCode'], code)
        self.assertEqual((self.root / 'course-videos/video.mp4').read_bytes(), b'unchanged fixture')

    def test_decoder_error_classification(self):
        fake_av = SimpleNamespace(open=lambda _: (_ for _ in ()).throw(ValueError('bad file')))
        with patch.dict(sys.modules, {'av': fake_av}), self.assertRaisesRegex(MediaError, 'corrupt_media'):
            inspect_audio('fixture')
        class Container:
            streams = SimpleNamespace(audio=[])
            def __enter__(self): return self
            def __exit__(self, *args): pass
        with patch.dict(sys.modules, {'av': SimpleNamespace(open=lambda _: Container())}), self.assertRaisesRegex(MediaError, 'missing_audio'):
            inspect_audio('fixture')

    def test_success_stores_timestamped_segments(self):
        self.worker.model = SimpleNamespace(transcribe=lambda *args, **kwargs: (iter([SimpleNamespace(start=0, end=2.5, text=' Hello ')]), SimpleNamespace(language='en')))
        job = self.worker.claim()
        with patch('worker.inspect_audio'):
            self.worker.process(job)
        saved = self.db.transcription_jobs.find_one({})
        self.assertEqual(saved['status'], 'completed')
        segment = self.db.transcript_segments.find_one({'resultToken': saved['resultToken']})
        self.assertEqual((segment['startTimeSeconds'], segment['endTimeSeconds'], segment['text']), (0, 2.5, 'Hello'))

    def test_path_escape_rejected(self):
        for name in ('../video.mp4', '/tmp/video.mp4'):
            with self.assertRaises(MediaError):
                source_path(self.root, {**self.source, 'storedName': name})


if __name__ == '__main__':
    unittest.main()

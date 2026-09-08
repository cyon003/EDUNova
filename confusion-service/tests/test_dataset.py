import unittest
from unittest.mock import patch

from bson import ObjectId

from confusion_ml.dataset import load_records

from confusion_ml.features import FEATURE_NAMES, feature_matrix, prepare_records, validate_record


def record(student="student-1", feedback="clear", **overrides):
    value = {"student": student, "confusionFeedback": feedback, "maximumVideoProgressPercent": 80.0, "activeTimeSeconds": 30, "pauseCount": 1, "replayCount": 0, "visitCount": 1, "lessonCompleted": False}
    value.update(overrides)
    return value


class DatasetTests(unittest.TestCase):
    def test_labels_and_null_feedback(self):
        frame, counts = prepare_records([record(feedback="clear"), record(student="student-2", feedback="confused"), record(student="student-3", feedback=None)])
        self.assertEqual(frame.target.tolist(), [0, 1])
        self.assertEqual(counts["unlabelled"], 1)

    def test_invalid_values_are_excluded(self):
        frame, counts = prepare_records([record(maximumVideoProgressPercent=101), record(pauseCount=1.5), record(lessonCompleted="true")])
        self.assertTrue(frame.empty)
        self.assertEqual(counts["invalid"], 3)

    def test_features_have_fixed_private_safe_order(self):
        frame, _ = prepare_records([record()])
        X, _ = feature_matrix(frame)
        self.assertEqual(list(X.columns), FEATURE_NAMES)
        self.assertNotIn("confusionFeedback", X.columns)
        for identifier in ("student", "course", "lessonId", "_id"):
            self.assertNotIn(identifier, X.columns)


class ConnectionTests(unittest.TestCase):
    def test_connection_certificate_options(self):
        cases = [
            ("mongodb+srv://example.invalid/test", True),
            ("mongodb://localhost/test?tls=true", True),
            ("mongodb://localhost/test?ssl=true", True),
            ("mongodb://localhost/test", False),
            ("mongodb+srv://example.invalid/test?tls=false", False),
            ("mongodb+srv://example.invalid/test?tlsCAFile=private.pem", False),
        ]
        for uri, uses_bundle in cases:
            with self.subTest(uri=uri), patch("confusion_ml.dataset.MongoClient") as client, patch("confusion_ml.dataset.certifi.where", return_value="trusted.pem"):
                load_records(uri, "test")
                expected = {"serverSelectionTimeoutMS": 5000}
                if uses_bundle:
                    expected["tlsCAFile"] = "trusted.pem"
                client.assert_called_once_with(uri, **expected)
                connection = client.return_value.__enter__.return_value
                connection.__getitem__.assert_called_once_with("test")

    def test_connection_can_filter_course(self):
        with patch("confusion_ml.dataset.MongoClient") as client:
            course_id = "507f1f77bcf86cd799439011"
            load_records("mongodb://localhost/test", "test", course_id)
            connection = client.return_value.__enter__.return_value
            database = connection.__getitem__.return_value
            collection = database.__getitem__.return_value
            collection.find.assert_called_once_with({"course": ObjectId(course_id)})


if __name__ == "__main__":
    unittest.main()

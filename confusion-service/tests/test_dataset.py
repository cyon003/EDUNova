import unittest

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


if __name__ == "__main__":
    unittest.main()

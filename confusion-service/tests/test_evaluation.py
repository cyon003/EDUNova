import unittest

from sklearn.ensemble import RandomForestClassifier

from confusion_ml.evaluation import evaluate_model
from confusion_ml.features import FEATURE_NAMES
from confusion_ml.training import split_by_student
from test_training import frame_with_students


class EvaluationTests(unittest.TestCase):
    def test_metrics_and_feature_importance_are_generated(self):
        train, test = split_by_student(frame_with_students(), 0.2, 42)
        model = RandomForestClassifier(n_estimators=10, random_state=42, class_weight="balanced", n_jobs=-1)
        model.fit(train[FEATURE_NAMES], train.target)
        metrics = evaluate_model(model, train, test)
        for key in ("accuracy", "balanced_accuracy", "confused_precision", "confused_recall", "confused_f1", "confusion_matrix", "majority_class_baseline_accuracy", "feature_importance", "roc_auc"):
            self.assertIn(key, metrics)
        self.assertEqual(set(metrics["feature_importance"]), set(FEATURE_NAMES))


if __name__ == "__main__":
    unittest.main()

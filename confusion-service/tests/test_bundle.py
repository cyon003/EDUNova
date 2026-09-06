import tempfile
import unittest
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier

from confusion_ml.bundle import build_metadata, save_bundle
from confusion_ml.config import TrainingConfig
from confusion_ml.features import FEATURE_NAMES


class BundleTests(unittest.TestCase):
    def test_bundle_contains_model_and_feature_metadata(self):
        config = TrainingConfig("", "edunova", 50, 10, 10, 0.2, 42, 10, 0.5, "test")
        model = RandomForestClassifier(n_estimators=1, random_state=42)
        metadata = build_metadata(model, config, {"valid_training_records": 0}, {"accuracy": 0.0})
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory) / "model.joblib"
            report = Path(directory) / "report.json"
            save_bundle(model, metadata, bundle, report)
            saved = joblib.load(bundle)
            self.assertIn("model", saved)
            self.assertEqual(saved["metadata"]["feature_names"], FEATURE_NAMES)
            self.assertEqual(saved["metadata"]["label_mapping"], {"clear": 0, "confused": 1})
            self.assertTrue(report.exists())


if __name__ == "__main__":
    unittest.main()

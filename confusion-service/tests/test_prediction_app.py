import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from app import ModelBundleError, create_app, load_model_bundle
from confusion_ml.features import FEATURE_NAMES


class FakeModel:
    classes_ = [0, 1]

    def predict_proba(self, rows):
        self.rows = rows
        return [[0.18, 0.82]]


def bundle():
    return FakeModel(), {"feature_names": FEATURE_NAMES, "model_version": "3b-v1", "decision_threshold": 0.5}


def features():
    return {"maximumVideoProgressPercent": 80, "activeTimeSeconds": 30, "pauseCount": 1, "replayCount": 0, "visitCount": 1, "lessonCompleted": False}


class PredictionAppTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app(bundle()).test_client()

    def test_valid_prediction(self):
        response = self.client.post("/predict", json=features())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["prediction"], "confused")
        self.assertEqual(response.json["confusionProbability"], 0.82)
        self.assertEqual(response.json["clearProbability"], 0.18)
        self.assertEqual(response.json["modelVersion"], "3b-v1")

    def test_missing_feature_is_rejected(self):
        body = features()
        del body["pauseCount"]
        self.assertEqual(self.client.post("/predict", json=body).status_code, 400)

    def test_invalid_numeric_value_is_rejected(self):
        body = features()
        body["maximumVideoProgressPercent"] = float("nan")
        self.assertEqual(self.client.post("/predict", json=body).status_code, 400)

    def test_invalid_boolean_value_is_rejected(self):
        body = features()
        body["lessonCompleted"] = 1
        self.assertEqual(self.client.post("/predict", json=body).status_code, 400)

    def test_unexpected_feature_is_rejected(self):
        body = features()
        body["studentId"] = "not-used"
        self.assertEqual(self.client.post("/predict", json=body).status_code, 400)

    def test_missing_bundle_has_clear_startup_error(self):
        with self.assertRaisesRegex(ModelBundleError, "Model bundle is missing"):
            load_model_bundle("/tmp/edunova-missing-phase-4-bundle.joblib")

    def test_invalid_bundle_has_clear_startup_error(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.joblib"
            path.write_text("not a joblib bundle")
            with self.assertRaisesRegex(ModelBundleError, "Model bundle is invalid"):
                load_model_bundle(path)


if __name__ == "__main__":
    unittest.main()
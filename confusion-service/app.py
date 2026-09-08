#!/usr/bin/env python3
import math
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request

from confusion_ml.config import model_bundle_path
from confusion_ml.features import FEATURE_NAMES


COUNTER_FEATURES = {"activeTimeSeconds", "pauseCount", "replayCount", "visitCount"}
MAX_COUNTER_VALUE = 1_000_000


class ModelBundleError(RuntimeError):
    pass


def load_model_bundle(path=None):
    bundle_path = Path(path or model_bundle_path()).expanduser()
    if not bundle_path.is_file():
        raise ModelBundleError(f"Model bundle is missing: {bundle_path}")
    try:
        bundle = joblib.load(bundle_path)
    except Exception as error:
        raise ModelBundleError(f"Model bundle is invalid: {bundle_path} ({error})") from error
    metadata = bundle.get("metadata") if isinstance(bundle, dict) else None
    model = bundle.get("model") if isinstance(bundle, dict) else None
    if not isinstance(metadata, dict) or model is None:
        raise ModelBundleError(f"Model bundle is invalid: {bundle_path} (missing model metadata)")
    if metadata.get("feature_names") != FEATURE_NAMES or not metadata.get("model_version"):
        raise ModelBundleError(f"Model bundle is invalid: {bundle_path} (feature schema or version mismatch)")
    if not callable(getattr(model, "predict_proba", None)):
        raise ModelBundleError(f"Model bundle is invalid: {bundle_path} (predict_proba is unavailable)")
    return model, metadata


def validate_features(body):
    if not isinstance(body, dict):
        return "Request body must be a JSON object"
    keys = set(body)
    required = set(FEATURE_NAMES)
    missing = sorted(required - keys)
    unexpected = sorted(keys - required)
    if missing:
        return f"Missing required feature: {missing[0]}"
    if unexpected:
        return f"Unexpected feature: {unexpected[0]}"
    progress = body["maximumVideoProgressPercent"]
    if isinstance(progress, bool) or not isinstance(progress, (int, float)) or not math.isfinite(progress) or not 0 <= progress <= 100:
        return "maximumVideoProgressPercent must be a finite number from 0 to 100"
    for field in COUNTER_FEATURES:
        value = body[field]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not float(value).is_integer() or not 0 <= value <= MAX_COUNTER_VALUE:
            return f"{field} must be a finite non-negative integer no greater than {MAX_COUNTER_VALUE}"
    if not isinstance(body["lessonCompleted"], bool):
        return "lessonCompleted must be boolean"
    return None


def predict(bundle, features):
    model, metadata = bundle
    matrix = pd.DataFrame([[features[name] for name in FEATURE_NAMES]], columns=FEATURE_NAMES)
    probabilities = model.predict_proba(matrix)[0]
    classes = list(getattr(model, "classes_", [0, 1]))
    probability_by_class = {int(label): float(probability) for label, probability in zip(classes, probabilities)}
    confused_probability = probability_by_class.get(1, 0.0)
    clear_probability = probability_by_class.get(0, 0.0)
    threshold = float(metadata.get("decision_threshold", 0.5))
    return {
        "prediction": "confused" if confused_probability >= threshold else "clear",
        "confusionProbability": confused_probability,
        "clearProbability": clear_probability,
        "modelVersion": metadata["model_version"],
        "predictedAt": datetime.now(timezone.utc).isoformat(),
    }


def create_app(bundle=None):
    app = Flask(__name__)
    loaded_bundle = bundle or load_model_bundle()

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "modelVersion": loaded_bundle[1]["model_version"]})

    @app.post("/predict")
    def prediction():
        body = request.get_json(silent=True)
        validation_error = validate_features(body)
        if validation_error:
            return jsonify({"message": validation_error}), 400
        return jsonify(predict(loaded_bundle, body))

    return app


if __name__ == "__main__":
    try:
        application = create_app()
    except ModelBundleError as error:
        raise SystemExit(f"Confusion service startup failed: {error}") from error
    application.run(host="127.0.0.1", port=5002)
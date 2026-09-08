import json
import platform
from datetime import datetime, timezone

import joblib

from .config import runtime_versions
from .features import FEATURE_NAMES, LABEL_MAPPING


def build_metadata(model, config, summary, metrics):
    return {
        "model_type": "RandomForestClassifier",
        "model_version": config.model_version,
        "training_timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "feature_names": FEATURE_NAMES,
        "label_mapping": LABEL_MAPPING,
        "random_state": config.random_state,
        "training_configuration": {"n_estimators": config.n_estimators, "class_weight": "balanced", "n_jobs": -1, "test_size": config.test_size, "database_name": config.database_name},
        "decision_threshold": config.decision_threshold,
        "dataset_summary": summary,
        "evaluation": metrics,
        **runtime_versions(),
        "platform_python": platform.python_version(),
    }


def save_bundle(model, metadata, bundle_path, report_path):
    bundle_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "metadata": metadata}, bundle_path)
    report_path.write_text(json.dumps(metadata, indent=2, default=float) + "\n", encoding="utf-8")

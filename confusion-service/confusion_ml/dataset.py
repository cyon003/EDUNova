import json
from datetime import datetime, timezone

import pandas as pd
from pymongo import MongoClient

from .features import FEATURE_NAMES, prepare_records


def load_records(mongo_uri, database="edunova"):
    with MongoClient(mongo_uri, serverSelectionTimeoutMS=5000) as client:
        return list(client[database]["learningsignals"].find({}))


def build_dataset(records):
    frame, counts = prepare_records(records)
    labels = frame["target"] if not frame.empty else pd.Series(dtype=int)
    clear_count = int((labels == 0).sum())
    confused_count = int((labels == 1).sum())
    labelled = clear_count + confused_count
    return frame, {
        "total_mongodb_records": len(records),
        "labelled_records": labelled,
        "unlabelled_records": counts["unlabelled"],
        "valid_training_records": len(frame),
        "excluded_invalid_records": counts["invalid"],
        "unique_students": counts["unique_students"],
        "clear_label_count": clear_count,
        "confused_label_count": confused_count,
        "class_percentages": {
            "clear": round(clear_count / labelled * 100, 2) if labelled else 0.0,
            "confused": round(confused_count / labelled * 100, 2) if labelled else 0.0,
        },
    }


def export_csv(frame, summary, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    report = dict(summary)
    report["exported_at"] = datetime.now(timezone.utc).isoformat()
    report["feature_names"] = FEATURE_NAMES
    report_path = path.with_suffix(".summary.json")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report_path

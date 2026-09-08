import json
from datetime import datetime, timezone

from urllib.parse import parse_qsl, urlsplit

import certifi
import pandas as pd
from bson import ObjectId
from pymongo import MongoClient

from .features import FEATURE_NAMES, prepare_records


def load_records(mongo_uri, database="edunova", course_id=None):
    uri = urlsplit(mongo_uri)
    options = {key.lower(): value for key, value in parse_qsl(uri.query)}
    tls = options.get("tls", options.get("ssl", "true" if uri.scheme == "mongodb+srv" else "false"))
    client_options = {"serverSelectionTimeoutMS": 5000}
    # Use a portable CA bundle for Atlas; retain explicit private CA configuration.
    if tls.lower() == "true" and "tlscafile" not in options:
        client_options["tlsCAFile"] = certifi.where()
    with MongoClient(mongo_uri, **client_options) as client:
        query = {"course": ObjectId(course_id)} if course_id else {}
        return list(client[database]["learningsignals"].find(query))


def build_dataset(records):
    frame, counts = prepare_records(records)
    combinations = {}
    for record in records:
        key = (str(record.get("student")), str(record.get("course")), str(record.get("lessonId")))
        combinations[key] = combinations.get(key, 0) + 1
    duplicate_combinations = sum(count > 1 for count in combinations.values())
    duplicate_records = sum(count - 1 for count in combinations.values() if count > 1)
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
        "duplicate_student_course_lesson_combinations": duplicate_combinations,
        "duplicate_records_beyond_first": duplicate_records,
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

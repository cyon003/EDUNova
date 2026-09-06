import math

import pandas as pd


FEATURE_NAMES = [
    "maximumVideoProgressPercent",
    "activeTimeSeconds",
    "pauseCount",
    "replayCount",
    "visitCount",
    "lessonCompleted",
]
LABEL_MAPPING = {"clear": 0, "confused": 1}
_COUNTERS = {"activeTimeSeconds", "pauseCount", "replayCount", "visitCount"}


def _finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_record(record):
    """Return a privacy-safe row and internal student key, or None if invalid/unlabelled."""
    if not record.get("student"):
        return None, "invalid"
    feedback = record.get("confusionFeedback")
    if feedback is None:
        return None, "unlabelled"
    if feedback not in LABEL_MAPPING:
        return None, "invalid"

    progress = record.get("maximumVideoProgressPercent")
    if not _finite_number(progress) or not 0 <= progress <= 100:
        return None, "invalid"
    values = {}
    for field in _COUNTERS:
        value = record.get(field)
        if not _finite_number(value) or value < 0 or not float(value).is_integer():
            return None, "invalid"
        values[field] = int(value)
    completion = record.get("lessonCompleted")
    if not isinstance(completion, bool):
        return None, "invalid"

    values["maximumVideoProgressPercent"] = float(progress)
    values["lessonCompleted"] = int(completion)
    values["target"] = LABEL_MAPPING[feedback]
    return values, str(record["student"])


def prepare_records(records):
    rows = []
    unlabelled = invalid = 0
    student_groups = {}
    for record in records:
        row, state = validate_record(record)
        if state == "unlabelled":
            unlabelled += 1
            continue
        if state == "invalid":
            invalid += 1
            continue
        student_key = str(record.get("student"))
        if student_key not in student_groups:
            student_groups[student_key] = len(student_groups)
        row["student_group"] = student_groups[student_key]
        rows.append(row)
    frame = pd.DataFrame(rows, columns=FEATURE_NAMES + ["target", "student_group"])
    return frame, {"unlabelled": unlabelled, "invalid": invalid, "unique_students": len(student_groups)}


def feature_matrix(frame):
    """Return only the fixed, non-identifying model columns and target."""
    return frame.loc[:, FEATURE_NAMES].copy(), frame["target"].astype(int).copy()

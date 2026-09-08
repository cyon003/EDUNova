from dataclasses import dataclass

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit

from .features import FEATURE_NAMES, feature_matrix


class InsufficientDataError(ValueError):
    pass


def check_minimum_data(frame, config):
    failures = []
    if len(frame) < config.min_training_rows:
        failures.append(f"valid labelled rows {len(frame)} < MIN_TRAINING_ROWS {config.min_training_rows}")
    class_counts = frame["target"].value_counts() if not frame.empty else pd.Series(dtype=int)
    for label, name in ((0, "clear"), (1, "confused")):
        if int(class_counts.get(label, 0)) < config.min_rows_per_class:
            failures.append(f"{name} rows {int(class_counts.get(label, 0))} < MIN_ROWS_PER_CLASS {config.min_rows_per_class}")
    groups = frame["student_group"].nunique() if not frame.empty else 0
    if groups < config.min_unique_students:
        failures.append(f"unique students {groups} < MIN_UNIQUE_STUDENTS {config.min_unique_students}")
    if failures:
        raise InsufficientDataError("insufficient labelled data: " + "; ".join(failures))


def split_by_student(frame, test_size=0.2, random_state=42, attempts=100):
    if frame["student_group"].nunique() < 2:
        raise InsufficientDataError("insufficient labelled data: at least two students are required to split")
    best = None
    for offset in range(attempts):
        splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state + offset)
        train_idx, test_idx = next(splitter.split(frame, frame["target"], frame["student_group"]))
        train = frame.iloc[train_idx]
        test = frame.iloc[test_idx]
        if set(train["target"]) == {0, 1} and set(test["target"]) == {0, 1}:
            return train.reset_index(drop=True), test.reset_index(drop=True)
        score = len(set(train["target"])) + len(set(test["target"]))
        if best is None or score > best[0]:
            best = (score, train, test)
    raise InsufficientDataError("insufficient labelled data: unable to create student-group split containing both labels")


def train_random_forest(train_frame, config):
    X, y = feature_matrix(train_frame)
    model = RandomForestClassifier(n_estimators=config.n_estimators, random_state=config.random_state, class_weight="balanced", n_jobs=-1)
    model.fit(X[FEATURE_NAMES], y)
    return model

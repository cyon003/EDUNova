from dataclasses import dataclass
from pathlib import Path
import os
import sys

from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(SERVICE_ROOT / ".env")


def _int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be an integer")


def _float(name, default):
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number")


@dataclass(frozen=True)
class TrainingConfig:
    mongo_uri: str
    database_name: str
    min_training_rows: int
    min_rows_per_class: int
    min_unique_students: int
    test_size: float
    random_state: int
    n_estimators: int
    decision_threshold: float
    model_version: str

    @classmethod
    def from_environment(cls):
        test_size = _float("TEST_SIZE", 0.2)
        threshold = _float("DECISION_THRESHOLD", 0.5)
        if not 0 < test_size < 1:
            raise ValueError("TEST_SIZE must be between 0 and 1")
        if not 0 <= threshold <= 1:
            raise ValueError("DECISION_THRESHOLD must be between 0 and 1")
        return cls(
            mongo_uri=os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/edunova"),
            database_name=os.getenv("MONGO_DB_NAME", "edunova"),
            min_training_rows=_int("MIN_TRAINING_ROWS", 50),
            min_rows_per_class=_int("MIN_ROWS_PER_CLASS", 10),
            min_unique_students=_int("MIN_UNIQUE_STUDENTS", 10),
            test_size=test_size,
            random_state=_int("RANDOM_STATE", 42),
            n_estimators=_int("N_ESTIMATORS", 200),
            decision_threshold=threshold,
            model_version=os.getenv("MODEL_VERSION", "3b-v1"),
        )


def generated_paths():
    return {
        "data": SERVICE_ROOT / "data" / "generated",
        "models": SERVICE_ROOT / "models" / "generated",
        "reports": SERVICE_ROOT / "reports" / "generated",
    }


def runtime_versions():
    import sklearn

    return {"scikit_learn_version": sklearn.__version__, "python_version": sys.version.split()[0]}

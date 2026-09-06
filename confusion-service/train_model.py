#!/usr/bin/env python3
import argparse
from pathlib import Path

from confusion_ml.config import TrainingConfig, generated_paths
from confusion_ml.bundle import build_metadata, save_bundle
from confusion_ml.dataset import build_dataset, load_records
from confusion_ml.evaluation import evaluate_model
from confusion_ml.training import check_minimum_data, split_by_student, train_random_forest


def main():
    parser = argparse.ArgumentParser(description="Train and evaluate the Phase 3B confusion classifier.")
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args()
    config = TrainingConfig.from_environment()
    frame, summary = build_dataset(load_records(config.mongo_uri, config.database_name))
    check_minimum_data(frame, config)
    train_frame, test_frame = split_by_student(frame, config.test_size, config.random_state)
    model = train_random_forest(train_frame, config)
    metrics = evaluate_model(model, train_frame, test_frame)
    paths = generated_paths()
    paths["models"].mkdir(parents=True, exist_ok=True)
    paths["reports"].mkdir(parents=True, exist_ok=True)
    stem = f"confusion-random-forest-{config.model_version}"
    bundle_path = paths["models"] / f"{stem}.joblib"
    report_path = args.report or paths["reports"] / f"{stem}.json"
    metadata = build_metadata(model, config, summary, metrics)
    save_bundle(model, metadata, bundle_path, report_path)
    print(f"Model bundle: {bundle_path}")
    print(f"Evaluation report: {report_path}")
    print(json.dumps(metrics, indent=2, default=float))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Training stopped: {error}")
        raise SystemExit(2)

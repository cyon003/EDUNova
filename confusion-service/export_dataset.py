#!/usr/bin/env python3
import argparse
from pathlib import Path

from confusion_ml.config import TrainingConfig, generated_paths
from confusion_ml.dataset import build_dataset, export_csv, load_records


def main():
    parser = argparse.ArgumentParser(description="Export and validate labelled learning signals.")
    parser.add_argument("--course-id", required=True, help="Only export learning signals for this course ID.")
    parser.add_argument("--output", type=Path, default=generated_paths()["data"] / "learning_signals.csv")
    args = parser.parse_args()
    config = TrainingConfig.from_environment()
    records = load_records(config.mongo_uri, config.database_name, args.course_id)
    frame, summary = build_dataset(records)
    summary_path = export_csv(frame, summary, args.output)
    print(f"Exported {len(frame)} valid labelled records to {args.output}")
    print(f"Unlabelled: {summary['unlabelled_records']}; invalid: {summary['excluded_invalid_records']}")
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()

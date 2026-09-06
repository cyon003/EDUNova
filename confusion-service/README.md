# EDUNova Student Confusion Heatmap — Phase 3B

Phase 3B prepares a real, labelled learning-signal dataset and trains an offline Random Forest classifier. It does not add a prediction API, tutor heatmap, frontend dashboard, or automatic production predictions. Those are Phase 3C work.

## Dataset and privacy

The exporter reads MongoDB's `learningsignals` collection. Only `confusionFeedback: "clear"` and `confusionFeedback: "confused"` are labelled. Missing feedback is reported as unlabelled and never guessed. Malformed records are excluded and counted.

The fixed model feature order is:

```text
maximumVideoProgressPercent, activeTimeSeconds, pauseCount,
replayCount, visitCount, lessonCompleted
```

`lessonCompleted` becomes `0` or `1`. The target is `clear = 0` and `confused = 1`. Feedback is the target, not an input: including it as a feature would leak the answer into the model. Student, course, lesson, identity, message, note, transcript, and timestamp fields are never placed in the feature matrix. Exported CSVs contain only an anonymous numeric `student_group` used for splitting.

## Setup

```bash
cd ~/Desktop/EDUNova/confusion-service
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
```

Create `.env` locally from `.env.example`; do not commit it. Defaults require at least 50 valid labelled rows, 10 rows per class, 10 unique students, and use a 20% test split with seed 42.

## Commands

Export and validate records:

```bash
python export_dataset.py
```

Train and evaluate, only when minimum real-data requirements pass:

```bash
python train_model.py
```

Run unit tests without MongoDB:

```bash
python -m unittest discover -s tests -v
```

Generated CSVs and summaries go to `data/generated/`, model bundles go to `models/generated/`, and evaluation metadata goes to `reports/generated/`. These paths are ignored by Git. Training exits non-zero with an `insufficient labelled data` explanation and creates no model when requirements fail.

## Training and evaluation

The model is a `RandomForestClassifier` with 200 estimators, `class_weight="balanced"`, `n_jobs=-1`, and `random_state=42`. Rows are split by anonymous student group, so one student's lessons cannot appear in both training and test sets. Evaluation includes accuracy, balanced accuracy, confused-class precision/recall/F1, confusion matrix, classification report, ROC-AUC when both test labels exist, majority-class baseline, split counts, and feature importance.

Precision asks how often predicted confusion is correct; recall asks how many truly confused cases are detected; F1 balances those measures. The evaluation confusion matrix is not the product's Student Confusion Heatmap. Accuracy alone does not establish reliability, especially with class imbalance; compare it with the majority baseline.

The saved joblib bundle contains the model and metadata: version, timestamp, exact feature order, labels, configuration, threshold, dataset counts, metrics, scikit-learn version, and Python version. The threshold is metadata for Phase 3C and is not used by a prediction API here.

## Limitations

Predictions will be risk estimates, not proof that a student is confused. Feedback may be sparse or subjective, and behavioural signals can be noisy. Reports do not export raw student IDs, but the source collection remains sensitive and must be access-controlled. Tutors make the final educational decision; the model does not automatically intervene or label a student.

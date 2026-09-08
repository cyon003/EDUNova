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
python export_dataset.py --course-id <COURSE_ID>
```

Train and evaluate, only when minimum real-data requirements pass:

```bash
python train_model.py --course-id <COURSE_ID>
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

## MongoDB TLS certificates

Atlas and other TLS connections use the `certifi` CA bundle so Python can verify server certificates on macOS. Install the service requirements after updating. Explicit `tlsCAFile` URI options are preserved for private certificate authorities; ordinary local MongoDB connections do not enable TLS automatically.

## Phase 4 prediction service

Install the requirements and start the service without retraining:

```bash
python app.py
```

The service loads `MODEL_BUNDLE_PATH` when set, otherwise the versioned bundle at `models/generated/confusion-random-forest-${MODEL_VERSION}.joblib`. It exposes `POST /predict` on port `5002` and accepts exactly the six feature fields listed above.

Tutor analytics reads grouped course sections from `GET /api/tutor/analytics`. Only valid `aiPrediction` values are aggregated. Lessons with zero predictions are omitted from the lesson list; lessons with one to four predictions are shown as `Collecting data`; five or more predictions receive the green, yellow, or red confusion level.

## Complete heatmap workflow

Students generate a prediction after meaningful lesson activity, lesson completion, lesson exit, or clarity feedback. The browser deduplicates requests per authenticated student, course, lesson, and session. The backend stores the result in `aiPrediction` on the existing one-record-per-student-course-lesson learning signal; `confusionFeedback` remains the student's separate self-reported label.

Tutors see aggregated lesson predictions through `GET /api/tutor/analytics` and the Analytics tab. Lessons with fewer than five valid predictions show `Not enough data`. Otherwise, 0–39% is green/low confusion, 40–69% is yellow/medium confusion, and 70–100% is red/high confusion. Run the confusion service, backend, and frontend locally before testing the workflow.

import numpy as np
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score

from .features import FEATURE_NAMES, feature_matrix


def evaluate_model(model, train_frame, test_frame):
    X_train, y_train = feature_matrix(train_frame)
    X_test, y_test = feature_matrix(test_frame)
    predictions = model.predict(X_test[FEATURE_NAMES])
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, predictions)),
        "confused_precision": float(precision_score(y_test, predictions, pos_label=1, zero_division=0)),
        "confused_recall": float(recall_score(y_test, predictions, pos_label=1, zero_division=0)),
        "confused_f1": float(f1_score(y_test, predictions, pos_label=1, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=[0, 1]).tolist(),
        "classification_report": classification_report(y_test, predictions, labels=[0, 1], target_names=["clear", "confused"], output_dict=True, zero_division=0),
        "majority_class_baseline_accuracy": float(accuracy_score(y_test, np.full(len(y_test), y_train.mode().iloc[0]))),
        "training_row_count": len(train_frame),
        "test_row_count": len(test_frame),
        "training_student_count": int(train_frame["student_group"].nunique()),
        "test_student_count": int(test_frame["student_group"].nunique()),
        "training_label_distribution": {str(k): int(v) for k, v in y_train.value_counts().sort_index().items()},
        "test_label_distribution": {str(k): int(v) for k, v in y_test.value_counts().sort_index().items()},
        "feature_importance": {name: float(value) for name, value in zip(FEATURE_NAMES, model.feature_importances_)},
    }
    if len(set(y_test)) == 2:
        metrics["roc_auc"] = float(roc_auc_score(y_test, model.predict_proba(X_test[FEATURE_NAMES])[:, 1]))
    return metrics

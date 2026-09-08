import unittest

from confusion_ml.config import TrainingConfig
from confusion_ml.features import prepare_records
from confusion_ml.training import InsufficientDataError, check_minimum_data, split_by_student
from test_dataset import record


def frame_with_students(students=12):
    rows = []
    for index in range(students):
        rows.extend([record(student=f"s{index}", feedback="clear"), record(student=f"s{index}", feedback="confused")])
    return prepare_records(rows)[0]


class TrainingTests(unittest.TestCase):
    def test_groups_do_not_overlap_and_are_reproducible(self):
        frame = frame_with_students()
        train, test = split_by_student(frame, 0.2, 42)
        self.assertTrue(set(train.student_group).isdisjoint(set(test.student_group)))
        train_again, test_again = split_by_student(frame, 0.2, 42)
        self.assertEqual(train.student_group.tolist(), train_again.student_group.tolist())
        self.assertEqual(test.student_group.tolist(), test_again.student_group.tolist())

    def test_insufficient_rows_and_missing_class_fail_safely(self):
        config = TrainingConfig("", "edunova", 50, 10, 10, 0.2, 42, 200, 0.5, "test")
        with self.assertRaises(InsufficientDataError):
            check_minimum_data(frame_with_students(2), config)
        missing = prepare_records([record(student=f"s{i}", feedback="clear") for i in range(12)])[0]
        with self.assertRaises(InsufficientDataError):
            check_minimum_data(missing, config)


if __name__ == "__main__":
    unittest.main()

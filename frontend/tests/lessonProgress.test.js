import assert from "node:assert/strict";
import test from "node:test";
import { nextIncompleteLessonIndex } from "../src/utils/lessonProgress.js";

test("continue learning advances past a completed lesson", () => {
  assert.equal(nextIncompleteLessonIndex(2, [0], 0), 1);
  assert.equal(nextIncompleteLessonIndex(3, [0, 1], 0), 2);
  assert.equal(nextIncompleteLessonIndex(3, [1], 2), 2);
  assert.equal(nextIncompleteLessonIndex(3, [1, 2], 2), 0);
  assert.equal(nextIncompleteLessonIndex(2, [0, 1], 1), 1);
  assert.equal(nextIncompleteLessonIndex(0, [], 0), 0);
});

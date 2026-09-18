import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("student course pages load account progress and complete individual lessons through the API", async () => {
  const player = await source("src/pages/LessonPlayer.jsx");
  const detail = await source("src/pages/CourseDetail.jsx");
  const myCourses = await source("src/pages/MyCourses.jsx");
  const dashboard = await source("src/pages/StudentDashboard.jsx");

  for (const page of [player, detail]) {
    assert.match(page, /enrollments\/me/);
    assert.match(page, /lessons\/\$\{[^}]+\}\/complete/);
    assert.doesNotMatch(page, /completedLessons:\s*(?:updated|localLessons|lessonItems|completed)/);
  }
  assert.match(myCourses, /\{course\.progress\}%/);
  assert.match(myCourses, /\{course\.completed\}\/\{course\.totalLessons\} lessons/);
  assert.match(dashboard, /completedCount \/ lessonCount \* 100/);
});

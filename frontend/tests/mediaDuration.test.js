import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatMediaDuration } from "../src/utils/mediaDuration.js";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("tutor media duration rounds up and is carried with uploaded video", async () => {
  assert.equal(formatMediaDuration(59.1), "1:00");
  assert.equal(formatMediaDuration(125), "2:05");
  assert.equal(formatMediaDuration(Number.POSITIVE_INFINITY), "");
  const manager = await source("src/components/LessonManager.jsx");
  const dashboard = await source("src/pages/TutorDashboard.jsx");
  assert.match(manager, /readMediaDuration\(file\)/);
  assert.match(manager, /onLoadedMetadata=/);
  assert.match(dashboard, /body\.append\("durationSeconds",String\(lessonForm\.durationSeconds\)\)/);
  assert.match(dashboard, /body\.append\("durationSeconds",String\(durationSeconds\)\)/);
});

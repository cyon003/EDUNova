import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("student lesson player restores server watch position and guards seeks before recording", async () => {
  const hook = await source("src/hooks/useLessonWatch.js");
  const player = await source("src/pages/LessonPlayer.jsx");
  assert.match(hook, /method: "PATCH"/);
  assert.match(hook, /furthestWatchedPosition/);
  assert.match(hook, /onSeeking\(event\)/);
  assert.match(hook, /player\.currentTime = limit/);
  assert.match(hook, /onTimeUpdate\(event\)/);
  assert.match(hook, /Date\.now\(\) - lastReportAt\.current >= 4000/);
  assert.match(player, /useLessonWatch/);
  assert.match(player, /controls=\{lessonWatch\.ready\}/);
  assert.match(player, /onSeeked=\{\(event\) => \{ lessonWatch\.mediaHandlers\.onSeeked\(event\); learningSignal\.mediaHandlers\.onSeeked\(event\); \}\}/);
  assert.match(player, /onCompleted: \(enrollment\) =>/);
  assert.match(player, /lessonWatch\.mediaHandlers\.onEnded\(event\)/);
});

test("media lesson cannot use the old manual completion or progress-position shortcut", async () => {
  const player = await source("src/pages/LessonPlayer.jsx");
  const details = await source("src/pages/CourseDetail.jsx");
  assert.match(player, /enrolled && !primaryMedia && <button/);
  assert.match(details, /enrolled && !primaryMedia && \(/);
  assert.match(player, /!getLessonPrimaryMedia\(lessons\[index\]\)/);
});

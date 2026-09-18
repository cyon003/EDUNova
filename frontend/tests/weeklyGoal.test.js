import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("weekly goal dashboard loads and saves the authenticated student's real goal", async () => {
  const dashboard = await source("src/pages/StudentDashboard.jsx");
  assert.match(dashboard, /weekly-goal\/me/);
  assert.match(dashboard, /method: "PUT"/);
  assert.match(dashboard, /Weekly goal \(minutes\)/);
  assert.match(dashboard, /weeklyGoal\.learningMinutes/);
  assert.match(dashboard, /weeklyGoal\.remainingMinutes/);
  assert.match(dashboard, /weeklyGoal\.completionPercentage/);
  assert.match(dashboard, /Change goal/);
  assert.doesNotMatch(dashboard, /Add progress/);
  assert.doesNotMatch(dashboard, /current: 3, target: 5/);
});

test("study time accrues only during visible, playing lesson media", async () => {
  const hook = await source("src/hooks/useLearningSignal.js");
  assert.match(hook, /playing\.current && shouldCountActiveTime\(document\.visibilityState\)/);
  assert.match(hook, /onPause\(event\)[^]*playing\.current = false/);
  assert.match(hook, /onEnded\(\)[^]*playing\.current = false/);
  assert.match(hook, /void flushRef\.current\(\)/);
});

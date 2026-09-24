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
  assert.match(hook, /session\.playing && shouldCountActiveTime\(document\.visibilityState\)/);
  assert.match(hook, /onPause\(event\)[^]*session\.playing = false/);
  assert.match(hook, /onEnded\(\)[^]*session\.playing = false/);
  assert.match(hook, /void flushTarget\(session\)/);
});

test("dashboard refreshes saved progress and shows distinct earned and locked awards", async () => {
  const dashboard = await source("src/pages/StudentDashboard.jsx");
  assert.match(dashboard, /addEventListener\("focus", refresh\)/);
  assert.match(dashboard, /addEventListener\("visibilitychange", refresh\)/);
  assert.match(dashboard, /addEventListener\("edunova-learning-updated", refresh\)/);
  assert.match(dashboard, /setAchievements\(goal\.achievements\)/);
  assert.match(dashboard, /achievement\.earned \? "Earned" : "Locked"/);
  assert.match(dashboard, /if \(!weeklyGoalEditing\) setWeeklyGoalInput/);
});

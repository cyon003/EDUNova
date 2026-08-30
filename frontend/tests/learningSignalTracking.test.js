import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isBackwardReplay, isStudentPause, LEARNING_SIGNAL_FLUSH_MS, maximumWatchedPercent, pendingSignalBody, shouldCountActiveTime, STRICT_MODE_VISIT_WINDOW_MS } from "../src/utils/learningSignalTracking.js";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("maximum video progress never moves backward and is capped at 100", () => {
  assert.equal(maximumWatchedPercent(0, 50, 100), 50);
  assert.equal(maximumWatchedPercent(80, 20, 100), 80);
  assert.equal(maximumWatchedPercent(0, 120, 100), 100);
  assert.equal(maximumWatchedPercent(40, 10, 0), 40);
});

test("pause detection requires recent student interaction while playing", () => {
  assert.equal(isStudentPause({ wasPlaying: true, intentAt: 1000, now: 2000, ended: false }), true);
  assert.equal(isStudentPause({ wasPlaying: false, intentAt: 1000, now: 2000, ended: false }), false);
  assert.equal(isStudentPause({ wasPlaying: true, intentAt: 1000, now: 3000, ended: false }), false);
  assert.equal(isStudentPause({ wasPlaying: true, intentAt: 1000, now: 1200, ended: true }), false);
});

test("replay detection counts only backward seeks of at least ten seconds", () => {
  assert.equal(isBackwardReplay(50, 40), true);
  assert.equal(isBackwardReplay(50, 40.1), false);
  assert.equal(isBackwardReplay(40, 60), false);
});

test("active time counts only while the document is visible", () => {
  assert.equal(shouldCountActiveTime("visible"), true);
  assert.equal(shouldCountActiveTime("hidden"), false);
  assert.equal(shouldCountActiveTime("prerender"), false);
});

test("pending signal updates are batched into one compact request body", () => {
  assert.equal(LEARNING_SIGNAL_FLUSH_MS, 25000);
  assert.deepEqual(pendingSignalBody({ maximumVideoProgressPercent: 65, activeTimeSecondsDelta: 25, pauseCountDelta: 0, replayCountDelta: 1, visitCountDelta: 1 }), { maximumVideoProgressPercent: 65, activeTimeSecondsDelta: 25, replayCountDelta: 1, visitCountDelta: 1 });
});

test("hook restores feedback, protects Strict Mode visits, batches, and flushes on exit", async () => {
  const hook = await source("src/hooks/useLearningSignal.js");
  assert.equal(STRICT_MODE_VISIT_WINDOW_MS, 2000);
  assert.match(hook, /recentVisits\.get\(visitKey\)/);
  assert.match(hook, /method: "PATCH"[^]*keepalive/);
  assert.match(hook, /window\.setInterval\(\(\) => flushRef\.current\(\), LEARNING_SIGNAL_FLUSH_MS\)/);
  assert.match(hook, /visibilitychange/);
  assert.match(hook, /pagehide/);
  assert.match(hook, /flushRef\.current\(\{ keepalive: true \}\)/);
  assert.match(hook, /setSignal\(saved\)/);
  assert.match(hook, /pending\.current\.[a-zA-Z]+[^]*fetch/);
});

test("timeupdate accumulates locally and tracking failures cannot break lesson behavior", async () => {
  const hook = await source("src/hooks/useLearningSignal.js");
  const player = await source("src/pages/LessonPlayer.jsx");
  const timeUpdateBody = hook.match(/onTimeUpdate\(event\) \{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(timeUpdateBody, /fetch/);
  assert.match(hook, /catch \(error\)[^]*setTrackingError/);
  assert.match(player, /No lesson video has been uploaded\./);
  assert.match(player, /useLearningSignal\(\{ courseId: course\?\._id, lessonId: lesson\?\._id \}\)/);
});

test("lesson feedback is optional, accessible, persistent, and changeable", async () => {
  const player = await source("src/pages/LessonPlayer.jsx");
  assert.match(player, /Was this lesson clear\?/);
  assert.match(player, /role="group" aria-label="Lesson clarity feedback"/);
  assert.match(player, /aria-pressed=\{learningSignal\.signal\.confusionFeedback==="clear"\}/);
  assert.match(player, /saveFeedback\("clear"\)/);
  assert.match(player, /saveFeedback\("confused"\)/);
  assert.match(player, /Saving…[^]*Saved/);
  assert.match(player, /activeTool==="content"/);
});

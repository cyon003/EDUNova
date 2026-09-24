import test from "node:test";
import assert from "node:assert/strict";
import { captureLessonMetadata, validLessonDuration } from "../src/utils/lessonMetadata.js";

test("original deferred metadata updater reproduces the cleared currentTarget crash", () => {
  const event = { currentTarget: { duration: 61.2 } };
  const originalUpdater = current => ({ ...current, duration: event.currentTarget.duration });
  event.currentTarget = null;
  assert.throws(() => originalUpdater({}), TypeError);
});

test("metadata captures duration synchronously and is safe to replay after the event is cleared", () => {
  const event = { currentTarget: { duration: 61.2 } };
  let updater;
  captureLessonMetadata(event, { lessonId: "first", savedDuration: "Provider managed", isCurrent: () => true, setDraft: value => { updater = value; } });
  event.currentTarget = null;
  const draft = { lessonId: "first", title: "Keep title", topics: [{ title: "Keep topic" }], quiz: { title: "Keep quiz" } };
  const updated = updater(draft);
  assert.equal(updated.duration, "1:02");
  assert.equal(updated.topics, draft.topics);
  assert.equal(updated.quiz, draft.quiz);
  assert.deepEqual(updater(draft), updated);
});

test("missing, zero, negative, nonnumeric and non-finite metadata never schedules a draft update", () => {
  for (const seconds of [undefined, null, "60", 0, -1, NaN, Infinity, 86401]) {
    captureLessonMetadata({ currentTarget: { duration: seconds } }, { lessonId: "first", isCurrent: () => true, setDraft: () => assert.fail(`accepted ${seconds}`) });
  }
  captureLessonMetadata({ currentTarget: null }, { lessonId: "first", setDraft: () => assert.fail("missing element") });
});

test("valid saved metadata and newer drafts are preserved; stale lessons and replacement media cannot receive old metadata", () => {
  for (const savedDuration of ["1:02", "60:00", "1:00:00", "00:01"]) {
    assert.equal(validLessonDuration(savedDuration), true);
    captureLessonMetadata({ currentTarget: { duration: 20 } }, { lessonId: "first", savedDuration, setDraft: () => assert.fail("overwrote valid metadata") });
  }
  for (const duration of ["", "Provider managed", "0:00", "1:99", "NaN", "Infinity"]) assert.equal(validLessonDuration(duration), false);
  let updater; let active = true;
  captureLessonMetadata({ currentTarget: { duration: 42 } }, { lessonId: "first", isCurrent: () => active, setDraft: value => { updater = value; } });
  for (const draft of [{ lessonId: "middle" }, { lessonId: "first", mainVideo: {} }, { lessonId: "first", duration: "2:00" }]) assert.equal(updater(draft), draft);
  active = false;
  const draft = { lessonId: "first" };
  assert.equal(updater(draft), draft);
});

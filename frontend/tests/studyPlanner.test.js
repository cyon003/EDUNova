import process from "node:process";
import test from "node:test";
import assert from "node:assert/strict";
import { localDateKey, monthDays, shiftMonth, scheduledLessonDates } from "../src/utils/studyPlanner.js";

test("calendar uses local dates, month offsets and leap years", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Bangkok";
    assert.equal(localDateKey(new Date("2026-09-24T18:00:00Z")), "2026-09-25");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(localDateKey(new Date("2026-09-25T01:00:00Z")), "2026-09-24");
    const september = monthDays(new Date(2026, 8, 1));
    assert.equal(september.offset, 2);
    assert.equal(september.days.length, 30);
    assert.equal(monthDays(new Date(2028, 1, 1)).days.length, 29);
    assert.equal(monthDays(new Date(2026, 1, 1)).days.length, 28);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test("navigation crosses year boundaries without moving scheduled lessons to other months", () => {
  assert.equal(localDateKey(shiftMonth(new Date(2026, 11, 31), 1)), "2027-01-01");
  assert.equal(localDateKey(shiftMonth(new Date(2026, 0, 31), -1)), "2025-12-01");
  assert.equal(scheduledLessonDates.has("2026-08-17"), true);
  assert.equal(scheduledLessonDates.has("2026-09-17"), false);
});

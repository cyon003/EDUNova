const test = require("node:test");
const assert = require("node:assert/strict");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { learningAchievements, synchronizeAchievements } = require("../services/achievementService");
const completed = (count, total = count) => ({ course: { lessons: Array(total).fill({}) }, completedLessons: Array.from({ length: count }, (_, index) => index) });

test("existing achievement thresholds ignore duplicates and empty courses", () => {
  assert.ok(learningAchievements([]).every(item => !item.earned));
  assert.equal(learningAchievements([completed(23, 24)])[1].earned, false);
  const record = completed(24);
  record.completedLessons.push(0, 99, -1);
  record.studyDates = Array.from({ length: 7 }, (_, index) => `2026-09-${index + 10}`);
  assert.ok(learningAchievements([record]).every(item => item.earned));
  record.studyDates.splice(3, 1);
  assert.equal(learningAchievements([record])[0].earned, false);
  assert.equal(learningAchievements([completed(0)])[2].earned, false);
});

test("awards persist per student and repeated refreshes cannot duplicate or revoke them", async t => {
  let records = [completed(24)];
  const stored = [];
  t.mock.method(Enrollment, "find", filter => {
    assert.equal(filter.student, "student");
    return { populate: async () => records };
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, { _id: "student", role: "student" });
    for (const id of update.$addToSet.earnedAchievementIds.$each) if (!stored.includes(id)) stored.push(id);
    return { earnedAchievementIds: [...stored] };
  });
  await synchronizeAchievements("student"); await synchronizeAchievements("student");
  assert.deepEqual(stored, ["lessons", "course"]);
  records = [];
  const restored = await synchronizeAchievements("student");
  assert.equal(restored.find(item => item.id === "course").earned, true);
  assert.equal(restored.find(item => item.id === "streak").earned, false);
});

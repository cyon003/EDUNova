const Enrollment = require("../models/Enrollment");
const User = require("../models/User");

// Criteria already displayed on the student dashboard; no new award types.
function learningAchievements(enrollments) {
  const dates = [...new Set(enrollments.flatMap(item => item.studyDates || []))].sort();
  let longest = 0, run = 0, previous = null;
  for (const date of dates) {
    const day = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(day)) continue;
    run = previous !== null && day - previous === 86400000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const counts = enrollments.map(item => {
    const total = item.course?.lessons?.length || 0;
    return { total, completed: new Set((item.completedLessons || []).filter(index => Number.isInteger(index) && index >= 0 && index < total)).size };
  });
  return [
    { id: "streak", title: "7-Day Streak", detail: "Learn on 7 consecutive days", earned: longest >= 7 },
    { id: "lessons", title: "Lesson Explorer", detail: "Complete 24 lessons", earned: counts.reduce((sum, item) => sum + item.completed, 0) >= 24 },
    { id: "course", title: "Course Finisher", detail: "Complete your first full course", earned: counts.some(item => item.total > 0 && item.completed === item.total) },
  ];
}

async function synchronizeAchievements(studentId) {
  const enrollments = await Enrollment.find({ student: studentId }).populate("course", "lessons");
  const achievements = learningAchievements(enrollments);
  const earned = achievements.filter(item => item.earned).map(item => item.id);
  const user = await User.findOneAndUpdate(
    { _id: studentId, role: "student" },
    { $addToSet: { earnedAchievementIds: { $each: earned } } },
    { new: true, runValidators: true }
  );
  const saved = new Set(user?.earnedAchievementIds || []);
  return achievements.map(item => ({ ...item, earned: saved.has(item.id) }));
}
module.exports = { learningAchievements, synchronizeAchievements };

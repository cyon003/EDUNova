const mongoose = require("mongoose");
const Course = require("../models/Course");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const PlatformSetting = require("../models/PlatformSetting");

function policyError(status, message) { return Object.assign(new Error(message), { status }); }
function checkEnrollmentPolicy(settings, course, count, { selfEnrollment = true } = {}) {
  if (!course || course.moderationStatus !== "published") throw policyError(403, "This course is not published for enrollment");
  if (selfEnrollment && settings?.allowSelfEnroll === false) throw policyError(403, "Self-enrollment is currently disabled");
  if (count >= (settings?.maxEnrollment ?? 150)) throw policyError(409, "This course has reached its enrollment limit");
}

async function purchaseTransaction(studentId, work) {
  return mongoose.connection.transaction(async (session) => {
    // A shared write serializes concurrent checkouts for the same student.
    const result = await User.updateOne({ _id: studentId }, { $inc: { purchaseRevision: 1 } }, { session });
    if (!result.matchedCount) throw policyError(404, "Student account not found");
    return work(session);
  });
}

async function enrollCourses(studentId, courseIds, session, { selfEnrollment = true, create = true, freeOnly = false } = {}) {
  const settings = await PlatformSetting.findOne({ key: "platform" }).session(session).lean();
  const courses = [];
  // Stable ordering avoids lock-order conflicts for multi-course checkouts.
  for (const id of [...new Set(courseIds.map(String))].sort()) {
    // This write forces transactions competing for the last seat to retry with a fresh count.
    const course = await Course.findOneAndUpdate({ _id: id }, { $inc: { enrollmentRevision: 1 } }, { session, new: true });
    if (!course) throw policyError(404, "Course not found");
    const existing = await Enrollment.findOne({ student: studentId, course: id }).session(session);
    if (!existing) {
      checkEnrollmentPolicy(settings, course, await Enrollment.countDocuments({ course: id }).session(session), { selfEnrollment });
      if (freeOnly && course.price > 0) throw policyError(402, "Complete payment before enrolling in this course");
      if (create) await Enrollment.create([{ student: studentId, course: id }], { session });
    }
    courses.push(course);
  }
  return courses;
}
module.exports = { checkEnrollmentPolicy, enrollCourses, purchaseTransaction, policyError };

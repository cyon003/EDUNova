const Notification = require("../models/Notification");

function createNotification({ user, course = null, source = "SYSTEM", type = "system", title, message }) {
  if (!user) return Promise.resolve(null);
  return Notification.create({ user, course, source, type, title, message });
}

function notifyCourseSubmitted({ user, course, resubmitted = false }) {
  return createNotification({
    user,
    course: course._id,
    type: "course_submitted",
    title: resubmitted ? "Course Resubmitted" : "Course Submitted",
    message: `Your course "${course.name}" has been ${resubmitted ? "resubmitted" : "submitted"} for admin review.`,
  });
}

function notifyCourseDecision({ user, course, approved, feedback = "" }) {
  return createNotification({
    user,
    course: course._id,
    source: "ADMIN",
    type: approved ? "course_approved" : "course_rejected",
    title: approved ? "Course Approved" : "Course Rejected",
    message: approved
      ? `Your course "${course.name}" has been approved and is now visible to students.`
      : `Your course "${course.name}" was not approved. Reason: ${feedback}`,
  });
}

function notifyTutorApplication({ user, status, reason = "" }) {
  const readableStatus = status.toLowerCase().replaceAll("_", " ");
  return createNotification({
    user,
    source: "ADMIN",
    type: "tutor_application",
    title: "Tutor Application Updated",
    message: `Your tutor application is now ${readableStatus}.${reason ? ` Details: ${reason}` : ""}`,
  });
}

function notifyAccountStatus({ user, accountStatus }) {
  return createNotification({
    user,
    source: "ADMIN",
    type: "account",
    title: "Account Status Updated",
    message: `Your EDUNOVA account is now ${accountStatus}.`,
  });
}

module.exports = {
  createNotification,
  notifyCourseSubmitted,
  notifyCourseDecision,
  notifyTutorApplication,
  notifyAccountStatus,
};

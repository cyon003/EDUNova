const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const Note = require("../models/Note");
const { lessonMediaFiles, prepareMediaRecovery, finishMediaRecovery } = require("./mediaRecoveryService");

function remapEnrollment(enrollment, removedIndex, oldCount) {
  const remap = index => index > removedIndex ? index - 1 : index;
  const survives = index => Number.isInteger(index) && index >= 0 && index < oldCount && index !== removedIndex;
  const remapMap = value => Object.fromEntries(Object.entries(value instanceof Map ? Object.fromEntries(value) : value || {})
    .filter(([key]) => /^(0|[1-9]\d*)$/.test(key) && survives(Number(key)))
    .map(([key, entry]) => [String(remap(Number(key))), entry]));
  return {
    completedLessons: [...new Set((enrollment.completedLessons || []).filter(survives).map(remap))],
    completedLessonDates: remapMap(enrollment.completedLessonDates),
    videoPositions: remapMap(enrollment.videoPositions),
    // If the active lesson was deleted, continue at its successor, or the last
    // remaining lesson. Empty courses retain the existing schema's zero sentinel.
    currentLessonIndex: Math.max(0, Math.min(remap(enrollment.currentLessonIndex || 0), oldCount - 2)),
    recentActivity: (enrollment.recentActivity || []).filter(activity => survives(activity.lessonIndex))
      .map(activity => ({ ...activity, lessonIndex: remap(activity.lessonIndex) })),
  };
}

async function deleteLesson(courseId, lessonId, tutorId) {
  let recovery;
  const course = await mongoose.connection.transaction(async session => {
    // Reload on every transaction retry; never remap already-remapped indexes.
    const current = await Course.findOne({ _id: courseId, tutor: tutorId }, null, { session });
    const lesson = current?.lessons.id(lessonId);
    if (!lesson) throw Object.assign(new Error("Lesson not found"), { status: 404 });
    const index = current.lessons.indexOf(lesson);
    const oldCount = current.lessons.length;
    const enrollments = await Enrollment.find({ course: current._id }, null, { session }).lean();
    const notes = await Note.find({ course: current._id, lessonIndex: { $gte: index } }, null, { session }).lean();
    recovery = await prepareMediaRecovery(lessonMediaFiles(lesson), {
      operation: "delete-lesson", courseId: String(current._id), lessonId: String(lesson._id), lessonIndex: index,
      lesson: lesson.toObject(),
      // Keep the removed index-based history recoverable as well as its media.
      enrollments: enrollments.map(item => ({ _id: item._id, completedLessons: item.completedLessons, completedLessonDates: item.completedLessonDates, videoPositions: item.videoPositions, currentLessonIndex: item.currentLessonIndex, recentActivity: item.recentActivity })),
      notes: notes.map(item => ({ _id: item._id, lessonIndex: item.lessonIndex })),
    });
    lesson.deleteOne();
    if (current.moderationStatus !== "rejected") current.moderationStatus = "unpublished";
    await current.save({ session });
    for (const enrollment of enrollments) {
      await Enrollment.updateOne({ _id: enrollment._id }, { $set: remapEnrollment(enrollment, index, oldCount) }, { session, runValidators: true });
    }
    // Preserve students' writing; detach only the deleted lesson's notes.
    await Note.updateMany({ course: current._id, lessonIndex: index }, { $set: { lessonIndex: null } }, { session });
    await Note.updateMany({ course: current._id, lessonIndex: { $gt: index } }, { $inc: { lessonIndex: -1 } }, { session });
    await LearningSignal.deleteMany({ course: current._id, lessonId }, { session });
    // Watch/exposure/event/quiz records use stable lesson IDs or historical
    // snapshots. Preserve them rather than assigning them to a different lesson.
    return current;
  });
  await finishMediaRecovery(recovery, course.lessons);
  return course;
}

module.exports = { remapEnrollment, deleteLesson };

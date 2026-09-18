const { enrollCourses, purchaseTransaction } = require("../services/enrollmentPolicy");
const express = require("express");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LessonWatch = require("../models/LessonWatch");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { synchronizeLessonCompletion } = require("../services/learningSignalService");
const { summarizeEnrollment } = require("../services/courseProgressService");
const { lessonMediaKey, watchState, advanceWatch, canCompleteWatchedMedia, statedDurationSeconds } = require("../services/lessonWatchService");

const router = express.Router();

async function recordLessonCompletion(studentId, course, lessonIndex) {
  const completedAt = new Date();
  let enrollment = await Enrollment.findOneAndUpdate(
    { student: studentId, course: course._id, completedLessons: { $ne: lessonIndex } },
    {
      $addToSet: { completedLessons: lessonIndex },
      $set: { [`completedLessonDates.${lessonIndex}`]: completedAt, lastAccessedAt: completedAt },
      $push: { recentActivity: { $each: [{ activityType: "lesson_completed", lessonIndex, lessonTitle: course.lessons[lessonIndex].title, createdAt: completedAt }], $slice: -50 } },
    },
    { new: true, runValidators: true }
  ).populate("course");
  if (enrollment) {
    try { await synchronizeLessonCompletion(studentId, course, enrollment.completedLessons); }
    catch (signalError) { console.error("Synchronize lesson completion signal error:", signalError); }
  } else {
    enrollment = await Enrollment.findOne({ student: studentId, course: course._id }).populate("course");
  }
  return enrollment;
}

router.use(authenticateToken);
router.use(requireRole("student"));

router.get("/me", async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate("course")
      .sort({ lastAccessedAt: -1, createdAt: -1 });
    return res.status(200).json(enrollments.filter((item) => item.course).map(summarizeEnrollment));
  } catch (error) {
    console.error("Get enrollments error:", error);
    return res.status(500).json({ message: "Unable to load enrolled courses" });
  }
});

router.post("/:slug", async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const enrollment = await purchaseTransaction(req.user._id, async (session) => {
      await enrollCourses(req.user._id, [course._id], session, { freeOnly: true });
      return Enrollment.findOneAndUpdate(
        { student: req.user._id, course: course._id },
        { $set: { lastAccessedAt: new Date() } },
        { new: true, session }
      ).populate("course");
    });
    return res.status(200).json(summarizeEnrollment(enrollment));
  } catch (error) {
    console.error("Enroll course error:", error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to enroll in this course" });
  }
});

router.patch("/:slug/progress", async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const body = req.body || {};
    if (Object.hasOwn(body, "completedLessons") || Object.hasOwn(body, "student") || Object.hasOwn(body, "studentId")) {
      return res.status(400).json({ message: "Lesson completion must use the authenticated per-lesson endpoint" });
    }

    const setFields = { lastAccessedAt: new Date() };
    if (Array.isArray(body.completedMissions)) setFields.completedMissions = [...new Set(body.completedMissions.filter((item) => typeof item === "string"))];
    if (Number.isInteger(body.currentLessonIndex) && body.currentLessonIndex >= 0 && body.currentLessonIndex < course.lessons.length) setFields.currentLessonIndex = body.currentLessonIndex;
    const videoLessonIndex = body.videoPosition?.lessonIndex;
    const videoSeconds = body.videoPosition?.seconds;
    if (Number.isInteger(videoLessonIndex) && lessonMediaKey(course.lessons[videoLessonIndex])) {
      return res.status(400).json({ message: "Video positions must use authenticated watch tracking" });
    }
    if (Number.isInteger(videoLessonIndex) && videoLessonIndex >= 0 && videoLessonIndex < course.lessons.length && Number.isFinite(videoSeconds) && videoSeconds >= 0) {
      setFields[`videoPositions.${videoLessonIndex}`] = videoSeconds;
    }
    const update = { $set: setFields };
    const studiedSeconds = Math.min(Math.max(Math.round(Number(body.studiedSeconds) || 0), 0), 3600);
    if (studiedSeconds > 0) {
      update.$inc = { studySeconds: studiedSeconds };
      const studyDate = String(body.studyDate || "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(studyDate)) update.$addToSet = { studyDates: studyDate };
    }
    const activity = body.activity;
    if (activity?.activityType === "lesson_opened" && Number.isInteger(activity.lessonIndex) && activity.lessonIndex >= 0 && activity.lessonIndex < course.lessons.length) {
      update.$push = { recentActivity: { $each: [{ activityType: "lesson_opened", lessonIndex: activity.lessonIndex, lessonTitle: course.lessons[activity.lessonIndex].title, createdAt: new Date() }], $slice: -50 } };
    }

    const enrollment = await Enrollment.findOneAndUpdate(
      { student: req.user._id, course: course._id },
      update,
      { new: true, runValidators: true }
    ).populate("course");
    if (!enrollment) return res.status(404).json({ message: "Enroll in this course first" });
    return res.status(200).json(summarizeEnrollment(enrollment));
  } catch (error) {
    console.error("Update course progress error:", error);
    return res.status(500).json({ message: "Unable to update course progress" });
  }
});

router.get("/:slug/lessons/:lessonIndex/watch", async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const index = Number(req.params.lessonIndex);
    if (!/^(0|[1-9]\d*)$/.test(req.params.lessonIndex) || !course.lessons[index]) return res.status(404).json({ message: "Lesson not found" });
    const mediaKey = lessonMediaKey(course.lessons[index]);
    if (!mediaKey) return res.status(404).json({ message: "Lesson has no tracked media" });
    const enrolled = await Enrollment.exists({ student: req.user._id, course: course._id });
    if (!enrolled) return res.status(404).json({ message: "Enroll in this course first" });
    const identity = { student: req.user._id, course: course._id, lesson: course.lessons[index]._id };
    const record = await LessonWatch.findOne(identity);
    return res.json(watchState(record, mediaKey));
  } catch (error) {
    console.error("Load watch progress error:", error);
    return res.status(500).json({ message: "Unable to load watch progress" });
  }
});

router.patch("/:slug/lessons/:lessonIndex/watch", async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const index = Number(req.params.lessonIndex);
    if (!/^(0|[1-9]\d*)$/.test(req.params.lessonIndex) || !course.lessons[index]) return res.status(404).json({ message: "Lesson not found" });
    const lesson = course.lessons[index];
    const mediaKey = lessonMediaKey(lesson);
    if (!mediaKey) return res.status(404).json({ message: "Lesson has no tracked media" });
    if (Object.keys(req.body || {}).some((key) => !["event", "position", "duration"].includes(key))) {
      return res.status(400).json({ message: "Watch update accepts only media playback fields" });
    }
    const enrolled = await Enrollment.exists({ student: req.user._id, course: course._id });
    if (!enrolled) return res.status(404).json({ message: "Enroll in this course first" });
    const identity = { student: req.user._id, course: course._id, lesson: lesson._id };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const previous = await LessonWatch.findOne(identity);
      const next = advanceWatch(previous, req.body || {}, new Date(), mediaKey, lesson.duration);
      if (next.error) return res.status(409).json({ message: next.error, progress: watchState(previous, mediaKey) });
      try {
        const saved = await LessonWatch.findOneAndUpdate(
          { ...identity, revision: previous?.revision || 0 },
          { $set: next, $inc: { revision: 1 } },
          { upsert: !previous, new: true, runValidators: true }
        );
        if (saved) {
          let completedEnrollment = null;
          if (!saved.completionRecordedAt && canCompleteWatchedMedia(saved, mediaKey, lesson.duration)) {
            completedEnrollment = await recordLessonCompletion(req.user._id, course, index);
            if (!completedEnrollment) return res.status(404).json({ message: "Enroll in this course first" });
            await LessonWatch.updateOne(
              { ...identity, mediaKey, completionRecordedAt: null },
              { $set: { completionRecordedAt: new Date() } }
            );
          }
          const data = typeof saved.toObject === "function" ? saved.toObject() : { ...saved };
          return res.json({ ...data, ...(completedEnrollment ? { enrollment: summarizeEnrollment(completedEnrollment) } : {}) });
        }
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    return res.status(409).json({ message: "Watch progress changed; retry the update" });
  } catch (error) {
    console.error("Update watch progress error:", error);
    return res.status(500).json({ message: "Unable to save watch progress" });
  }
});

router.post("/:slug/lessons/:lessonIndex/complete", async (req, res) => {
  try {
    if (Object.keys(req.body || {}).length) return res.status(400).json({ message: "Completion does not accept client-supplied progress or identity" });
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const indexText = req.params.lessonIndex;
    const lessonIndex = Number(indexText);
    if (!/^(0|[1-9]\d*)$/.test(indexText) || !Number.isSafeInteger(lessonIndex) || lessonIndex >= course.lessons.length) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const mediaKey = lessonMediaKey(course.lessons[lessonIndex]);
    if (mediaKey) {
      const existingEnrollment = await Enrollment.findOne({ student: req.user._id, course: course._id }).populate("course");
      if (!existingEnrollment) return res.status(404).json({ message: "Enroll in this course first" });
      if (existingEnrollment.completedLessons?.includes(lessonIndex)) return res.status(200).json(summarizeEnrollment(existingEnrollment));
      if (!statedDurationSeconds(course.lessons[lessonIndex].duration)) return res.status(409).json({ message: "Ask your tutor to confirm this video's duration before completion" });
      const watch = await LessonWatch.findOne({ student: req.user._id, course: course._id, lesson: course.lessons[lessonIndex]._id });
      if (!canCompleteWatchedMedia(watch, mediaKey, course.lessons[lessonIndex].duration)) return res.status(409).json({ message: "Watch at least 95% of this lesson before completion" });
    }
    const enrollment = await recordLessonCompletion(req.user._id, course, lessonIndex);
    if (!enrollment) return res.status(404).json({ message: "Enroll in this course first" });
    return res.status(200).json(summarizeEnrollment(enrollment));
  } catch (error) {
    console.error("Complete lesson error:", error);
    return res.status(500).json({ message: "Unable to complete lesson" });
  }
});

module.exports = router;

const express = require("express");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const PlatformSetting = require("../models/PlatformSetting");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole("student"));

router.get("/me", async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate("course")
      .sort({ lastAccessedAt: -1, createdAt: -1 });
    return res.status(200).json(enrollments.filter((item) => item.course));
  } catch (error) {
    console.error("Get enrollments error:", error);
    return res.status(500).json({ message: "Unable to load enrolled courses" });
  }
});

router.post("/:slug", async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const settings = await PlatformSetting.findOne({ key: "platform" }).lean();
    if (settings?.allowSelfEnroll === false) return res.status(403).json({ message: "Self-enrollment is currently disabled" });
    if (course.moderationStatus !== "published") return res.status(403).json({ message: "This course is not approved for enrollment" });
    const existingEnrollment = await Enrollment.findOne({ student: req.user._id, course: course._id });
    if (!existingEnrollment && course.price > 0) {
      return res.status(402).json({
        message: "Purchase this course before enrolling",
        requiresPurchase: true,
        courseSlug: course.slug,
      });
    }
    if (!existingEnrollment && settings?.maxEnrollment) {
      const enrollmentCount = await Enrollment.countDocuments({ course: course._id });
      if (enrollmentCount >= settings.maxEnrollment) return res.status(409).json({ message: "This course has reached its enrollment limit" });
    }

    const enrollment = await Enrollment.findOneAndUpdate(
      { student: req.user._id, course: course._id },
      { $set: { lastAccessedAt: new Date() }, $setOnInsert: { completedLessons: [], completedMissions: [] } },
      { new: true, upsert: true, runValidators: true }
    ).populate("course");
    return res.status(200).json(enrollment);
  } catch (error) {
    console.error("Enroll course error:", error);
    return res.status(500).json({ message: "Unable to enroll in this course" });
  }
});

router.patch("/:slug/progress", async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const setFields = { lastAccessedAt: new Date() };
    if (Array.isArray(req.body.completedLessons)) setFields.completedLessons = [...new Set(req.body.completedLessons.filter((item) => Number.isInteger(item) && item >= 0))];
    if (Array.isArray(req.body.completedMissions)) setFields.completedMissions = [...new Set(req.body.completedMissions.filter((item) => typeof item === "string"))];
    if (Number.isInteger(req.body.currentLessonIndex) && req.body.currentLessonIndex >= 0) setFields.currentLessonIndex = req.body.currentLessonIndex;
    const videoLessonIndex = req.body.videoPosition?.lessonIndex;
    const videoSeconds = req.body.videoPosition?.seconds;
    if (Number.isInteger(videoLessonIndex) && videoLessonIndex >= 0 && Number.isFinite(videoSeconds) && videoSeconds >= 0) {
      setFields[`videoPositions.${videoLessonIndex}`] = videoSeconds;
    }
    const update = { $set: setFields };
    const studiedSeconds = Math.min(Math.max(Math.round(Number(req.body.studiedSeconds) || 0), 0), 3600);
    if (studiedSeconds > 0) {
      update.$inc = { studySeconds: studiedSeconds };
      const studyDate = String(req.body.studyDate || "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(studyDate)) update.$addToSet = { studyDates: studyDate };
    }
    const activity = req.body.activity;
    if (["lesson_opened", "lesson_completed"].includes(activity?.activityType) && Number.isInteger(activity.lessonIndex) && activity.lessonIndex >= 0 && typeof activity.lessonTitle === "string" && activity.lessonTitle.trim()) {
      update.$push = { recentActivity: { $each: [{ activityType: activity.activityType, lessonIndex: activity.lessonIndex, lessonTitle: activity.lessonTitle.trim(), createdAt: new Date() }], $slice: -50 } };
    }

    const enrollment = await Enrollment.findOneAndUpdate(
      { student: req.user._id, course: course._id },
      update,
      { new: true, runValidators: true }
    ).populate("course");
    if (!enrollment) return res.status(404).json({ message: "Enroll in this course first" });
    return res.status(200).json(enrollment);
  } catch (error) {
    console.error("Update course progress error:", error);
    return res.status(500).json({ message: "Unable to update course progress" });
  }
});

module.exports = router;

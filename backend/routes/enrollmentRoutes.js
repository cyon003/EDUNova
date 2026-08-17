const express = require("express");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
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

    const update = { lastAccessedAt: new Date() };
    if (Array.isArray(req.body.completedLessons)) update.completedLessons = [...new Set(req.body.completedLessons.filter((item) => Number.isInteger(item) && item >= 0))];
    if (Array.isArray(req.body.completedMissions)) update.completedMissions = [...new Set(req.body.completedMissions.filter((item) => typeof item === "string"))];

    const enrollment = await Enrollment.findOneAndUpdate(
      { student: req.user._id, course: course._id },
      { $set: update },
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

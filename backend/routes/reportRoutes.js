const express = require("express");
const Report = require("../models/Report");
const Course = require("../models/Course");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authenticateToken);

router.post("/", async (req, res) => {
  try {
    const { type, detail, priority = "medium", courseSlug, targetUserId } = req.body;
    if (!type?.trim() || !detail?.trim()) return res.status(400).json({ message: "Report type and details are required" });
    if (detail.trim().length < 10) return res.status(400).json({ message: "Please provide at least 10 characters of detail" });
    if (!["low", "medium", "high", "urgent"].includes(priority)) return res.status(400).json({ message: "Invalid priority" });

    const course = courseSlug ? await Course.findOne({ slug: courseSlug.toLowerCase() }) : null;
    if (courseSlug && !course) return res.status(404).json({ message: "Course not found" });
    const targetUser = targetUserId ? await User.findById(targetUserId) : null;
    if (targetUserId && !targetUser) return res.status(404).json({ message: "Reported user not found" });

    const report = await Report.create({
      type: type.trim(),
      detail: detail.trim(),
      priority,
      course: course?._id || null,
      targetUser: targetUser?._id || null,
      reporter: req.user._id,
    });
    return res.status(201).json({ message: "Report submitted successfully", report });
  } catch (error) {
    return res.status(500).json({ message: "Unable to submit report", error: error.message });
  }
});

module.exports = router;

const express = require("express");
const mongoose = require("mongoose");

const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const Course = require("../models/Course");
const User = require("../models/User");

const router = express.Router();

router.use(authenticateToken, requireRole("student"));

router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: "favoriteCourses",
        match: { moderationStatus: "published" },
        options: { sort: { name: 1 } },
      })
      .select("favoriteCourses")
      .lean();

    return res.status(200).json({ favorites: user?.favoriteCourses || [] });
  } catch (error) {
    console.error("Get favorites error:", error);
    return res.status(500).json({ message: "Unable to load saved courses" });
  }
});

router.post("/:courseId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.courseId)) {
      return res.status(400).json({ message: "Invalid course" });
    }

    const course = await Course.findOne({
      _id: req.params.courseId,
      moderationStatus: "published",
    }).lean();
    if (!course) return res.status(404).json({ message: "Course not found" });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { favoriteCourses: course._id },
    });

    return res.status(200).json({ message: "Course saved", course });
  } catch (error) {
    console.error("Save favorite error:", error);
    return res.status(500).json({ message: "Unable to save course" });
  }
});

router.delete("/:courseId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.courseId)) {
      return res.status(400).json({ message: "Invalid course" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { favoriteCourses: req.params.courseId },
    });

    return res.status(200).json({ message: "Course removed" });
  } catch (error) {
    console.error("Remove favorite error:", error);
    return res.status(500).json({ message: "Unable to remove saved course" });
  }
});

module.exports = router;

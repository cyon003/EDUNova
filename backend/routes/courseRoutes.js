const express = require("express");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

const publiclyVisible = { moderationStatus: "published" };

// GET /api/courses — list all published courses (public)
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find(publiclyVisible).sort({
      rating: -1,
      name: 1,
    });
    return res.status(200).json(courses);
  } catch (error) {
    console.error("Get courses error:", error);
    return res.status(500).json({ message: "Unable to load courses" });
  }
});

// GET /api/courses/:slug — get course details (public)
// Returns full course info but strips lesson videoUrl for paid unenrolled students
router.get("/:slug", async (req, res) => {
  try {
    const course = await Course.findOne({
      slug: req.params.slug.toLowerCase(),
      ...publiclyVisible,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // If course is free, return everything
    if (!course.price || course.price === 0) {
      return res.status(200).json(course);
    }

    // For paid courses — check if user is authenticated and enrolled
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        const enrollment = await Enrollment.exists({
          student: decoded.id,
          course: course._id,
        });
        if (enrollment) {
          // Enrolled — return full course with lesson video URLs
          return res.status(200).json(course);
        }
      } catch {
        // Invalid token — fall through to restricted response
      }
    }

    // Not enrolled in paid course — return course info but hide lesson video URLs
    const restricted = course.toObject();
    restricted.lessons = restricted.lessons.map((lesson) => ({
      ...lesson,
      videoUrl: "",        // hide video
      resources: [],       // hide downloadable resources
    }));
    restricted._restricted = true;

    return res.status(200).json(restricted);
  } catch (error) {
    console.error("Get course error:", error);
    return res.status(500).json({ message: "Unable to load the course" });
  }
});

// GET /api/courses/:slug/lessons/:lessonIndex — protected lesson access
// Requires authentication + enrollment for paid courses
router.get("/:slug/lessons/:lessonIndex", authenticateToken, async (req, res) => {
  try {
    const course = await Course.findOne({
      slug: req.params.slug.toLowerCase(),
      ...publiclyVisible,
    });

    if (!course) return res.status(404).json({ message: "Course not found" });

    const lessonIndex = parseInt(req.params.lessonIndex, 10);
    if (Number.isNaN(lessonIndex) || lessonIndex < 0 || lessonIndex >= course.lessons.length) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    // For paid courses — require enrollment
    if (course.price && course.price > 0) {
      const enrolled = await Enrollment.exists({
        student: req.user._id,
        course: course._id,
      });
      if (!enrolled) {
        return res.status(403).json({
          message: "You must purchase this course to access lessons",
          requiresPurchase: true,
          courseSlug: course.slug,
        });
      }
    }

    return res.status(200).json(course.lessons[lessonIndex]);
  } catch (error) {
    console.error("Get lesson error:", error);
    return res.status(500).json({ message: "Unable to load lesson" });
  }
});

module.exports = router;

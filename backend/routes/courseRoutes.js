const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const authenticateToken = require("../middleware/authMiddleware");
const { restrictCourseContent } = require("../utils/courseAccess");

const router = express.Router();

const publiclyVisible = { moderationStatus: "published" };
const uploadRoot = path.resolve(__dirname, "..", "uploads");
const mediaExtensions = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|m4a|ogg)$/i;

function safeUploadPath(storage, storedName) {
  if (!["course-videos", "lesson-resources"].includes(storage) || !storedName || path.basename(storedName) !== storedName) throw new Error("unsafe_path");
  const directory = path.join(uploadRoot, storage);
  const resolved = path.resolve(directory, storedName);
  if (!resolved.startsWith(`${directory}${path.sep}`)) throw new Error("unsafe_path");
  return resolved;
}

function legacyStoredName(url) {
  try { return path.basename(new URL(url).pathname); } catch { return path.basename(String(url || "")); }
}

function legacyMediaType(storedName) {
  const extension = path.extname(storedName).toLowerCase();
  return ({ ".webm": "video/webm", ".ogv": "video/ogg", ".ogg": "video/ogg", ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4" })[extension] || "video/mp4";
}

function primaryMediaFor(lesson) {
  if (lesson.primaryMedia?.storedName) return lesson.primaryMedia;
  if (lesson.primaryMediaRemoved) return null;
  const resource = lesson.resources?.find((item) => /^(video|audio)\//i.test(item.mimeType || "") || mediaExtensions.test(item.originalName || ""));
  if (resource) return { ...(typeof resource.toObject === "function" ? resource.toObject() : resource), storage: "lesson-resources", resourceId: resource._id };
  if (String(lesson.videoUrl || "").includes("/uploads/course-videos/")) {
    const storedName = legacyStoredName(lesson.videoUrl);
    return { originalName: storedName, storedName, mimeType: legacyMediaType(storedName), size: 0, storage: "course-videos" };
  }
  return null;
}

async function authorizedLesson(req, res) {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase() });
  if (!course) { res.status(404).json({ message: "Course not found" }); return null; }
  const lessonIndex = Number.parseInt(req.params.lessonIndex, 10);
  if (!Number.isInteger(lessonIndex) || lessonIndex < 0 || lessonIndex >= course.lessons.length) { res.status(404).json({ message: "Lesson not found" }); return null; }
  const ownsCourse = req.user.role === "tutor" && String(course.tutor) === String(req.user._id);
  const enrolled = req.user.role === "student" && await Enrollment.exists({ student: req.user._id, course: course._id });
  if (req.user.role !== "admin" && !ownsCourse && !enrolled) { res.status(403).json({ message: "You do not have access to this lesson resource" }); return null; }
  return { course, lesson: course.lessons[lessonIndex] };
}

function sendProtectedFile(res, descriptor, disposition) {
  let filePath;
  try { filePath = safeUploadPath(descriptor.storage, descriptor.storedName); } catch { return res.status(404).json({ message: "Lesson resource not found" }); }
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Lesson resource not found" });
  const safeName = path.basename(descriptor.originalName || descriptor.storedName).replace(/[\r\n"]/g, "_");
  res.setHeader("Content-Type", descriptor.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `${disposition}; filename="${safeName}"`);
  if (/^(video|audio)\//i.test(descriptor.mimeType || "")) res.setHeader("Accept-Ranges", "bytes");
  return res.sendFile(filePath);
}

function mediaTokenAuth(req, res, next) {
  const token = String(req.query.token || "");
  if (!token) return authenticateToken(req, res, next);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.mediaScope !== `${req.params.slug.toLowerCase()}:${req.params.lessonIndex}`) return res.status(403).json({ message: "Invalid media access" });
    req.headers.authorization = `Bearer ${token}`;
    return authenticateToken(req, res, next);
  } catch { return res.status(401).json({ message: "Media access has expired" }); }
}

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
    return res.status(200).json(restrictCourseContent(course));
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

router.get("/:slug/lessons/:lessonIndex/media-access", authenticateToken, async (req, res) => {
  try {
    const access = await authorizedLesson(req, res);
    if (!access) return;
    if (!primaryMediaFor(access.lesson)) return res.status(404).json({ message: "Lesson media not found" });
    const token = jwt.sign({ id: req.user._id, role: req.user.role, tokenVersion: req.user.tokenVersion || 0, mediaScope: `${req.params.slug.toLowerCase()}:${req.params.lessonIndex}` }, process.env.JWT_SECRET, { expiresIn: "10m" });
    return res.json({ url: `${req.protocol}://${req.get("host")}/api/courses/${encodeURIComponent(req.params.slug.toLowerCase())}/lessons/${req.params.lessonIndex}/media?token=${encodeURIComponent(token)}` });
  } catch (error) { console.error("Create media access error:", error); return res.status(500).json({ message: "Unable to create media access" }); }
});

router.get("/:slug/lessons/:lessonIndex/media", mediaTokenAuth, async (req, res) => {
  try {
    const access = await authorizedLesson(req, res);
    if (!access) return;
    const media = primaryMediaFor(access.lesson);
    if (!media) return res.status(404).json({ message: "Lesson media not found" });
    return sendProtectedFile(res, media, "inline");
  } catch (error) { console.error("View lesson media error:", error); return res.status(500).json({ message: "Unable to load lesson media" }); }
});

router.get("/:slug/lessons/:lessonIndex/resources/:resourceId/:action", authenticateToken, async (req, res) => {
  try {
    if (!["view", "download"].includes(req.params.action)) return res.status(404).json({ message: "Route not found" });
    const access = await authorizedLesson(req, res);
    if (!access) return;
    const resource = access.lesson.resources.id(req.params.resourceId);
    if (!resource) return res.status(404).json({ message: "Lesson resource not found" });
    return sendProtectedFile(res, { ...resource.toObject(), storage: "lesson-resources" }, req.params.action === "download" ? "attachment" : "inline");
  } catch (error) { console.error("Lesson resource access error:", error); return res.status(500).json({ message: "Unable to load lesson resource" }); }
});

module.exports = router;

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const Notification = require("../models/Notification");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();
const videoDirectory = path.join(__dirname, "..", "uploads", "course-videos");
fs.mkdirSync(videoDirectory, { recursive: true });
const lessonResourceDirectory = path.join(__dirname, "..", "uploads", "lesson-resources");
fs.mkdirSync(lessonResourceDirectory, { recursive: true });
const coverDirectory = path.join(__dirname, "..", "uploads", "course-covers");
fs.mkdirSync(coverDirectory, { recursive: true });
const uploadCover = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, coverDirectory),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith("image/")),
});
const lessonFileTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "video/mp4"]);
const uploadLessonFiles = multer({
  storage: multer.diskStorage({
    destination: (_req, file, callback) => callback(null, file.fieldname === "video" ? videoDirectory : lessonResourceDirectory),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, file.mimetype.startsWith("image/") || lessonFileTypes.has(file.mimetype) || [".pdf", ".doc", ".docx", ".mp4", ".jpg", ".jpeg", ".png", ".webp"].includes(extension));
  },
});
const receiveLessonFiles = uploadLessonFiles.fields([{ name: "video", maxCount: 1 }, { name: "resources", maxCount: 10 }]);
router.use(authenticateToken);
router.use(requireRole("tutor"));

const percent = (enrollment) => {
  const total = enrollment.course?.lessons?.length || 0;
  return total ? Math.round((enrollment.completedLessons.length / total) * 100) : 0;
};

async function tutorData(tutorId) {
  const courses = await Course.find({ tutor: tutorId }).sort({ updatedAt: -1 });
  const ids = courses.map((course) => course._id);
  const enrollments = await Enrollment.find({ course: { $in: ids } })
    .populate("student", "name email")
    .populate("course", "name slug lessons")
    .sort({ lastAccessedAt: -1 });
  return { courses, enrollments: enrollments.filter((item) => item.course && item.student) };
}

router.get("/dashboard", async (req, res) => {
  try {
    const { courses, enrollments } = await tutorData(req.user._id);
    const uniqueStudents = new Set(enrollments.map((item) => String(item.student._id))).size;
    const averageProgress = enrollments.length ? Math.round(enrollments.reduce((sum, item) => sum + percent(item), 0) / enrollments.length) : 0;
    const recentActivity = enrollments.flatMap((enrollment) => enrollment.recentActivity.map((activity) => ({ ...activity.toObject(), student: enrollment.student.name, course: enrollment.course.name }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    return res.json({ totals: { courses: courses.length, students: uniqueStudents, enrollments: enrollments.length, averageProgress }, recentCourses: courses.slice(0, 5), recentActivity });
  } catch (error) { return res.status(500).json({ message: "Unable to load tutor overview", error: error.message }); }
});

router.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find({ tutor: req.user._id }).sort({ updatedAt: -1 }).lean();
    const counts = await Enrollment.aggregate([{ $match: { course: { $in: courses.map((item) => item._id) } } }, { $group: { _id: "$course", students: { $sum: 1 } } }]);
    const byCourse = new Map(counts.map((item) => [String(item._id), item.students]));
    return res.json(courses.map((course) => ({ ...course, students: byCourse.get(String(course._id)) || 0 })));
  } catch (error) { return res.status(500).json({ message: "Unable to load courses", error: error.message }); }
});

router.post("/courses", uploadCover.single("cover"), async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Course title is required" });
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "course";
    const slug = `${base}-${Date.now().toString(36)}`;
    const thumbnail = req.file ? `${req.protocol}://${req.get("host")}/uploads/course-covers/${req.file.filename}` : "";
    const course = await Course.create({ name, slug, tutor: req.user._id, category: req.body.category || "General Education", description: req.body.description || "Course description coming soon.", level: req.body.level || "Beginner", duration: "Automatically calculated", rating: 0, thumbnail, moderationStatus: "unpublished", lessons: [] });
    return res.status(201).json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to create course", error: error.message }); }
});

router.patch("/courses/:courseId", uploadCover.single("cover"), async (req, res) => {
  try {
    const allowed = ["name", "category", "description", "level"];
    const update = {};
    allowed.forEach((key) => { if (req.body[key] !== undefined) update[key] = req.body[key]; });
    if (req.file) update.thumbnail = `${req.protocol}://${req.get("host")}/uploads/course-covers/${req.file.filename}`;
    if (req.body.action === "publish") update.moderationStatus = "pending";
    if (req.body.action === "unpublish") update.moderationStatus = "unpublished";
    const currentCourse = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id }).select("moderationStatus name tutor");
    if (!currentCourse) return res.status(404).json({ message: "Course not found" });
    if (!req.body.action && Object.keys(update).length && currentCourse.moderationStatus !== "rejected") update.moderationStatus = "unpublished";
    const course = await Course.findOneAndUpdate({ _id: req.params.courseId, tutor: req.user._id }, { $set: update }, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (req.body.action === "publish") {
      const resubmitted = currentCourse.moderationStatus === "rejected";
      await Notification.create({ user: req.user._id, course: course._id, source: "SYSTEM", title: resubmitted ? "Course Resubmitted" : "Course Submitted", message: `Your course \"${course.name}\" has been ${resubmitted ? "resubmitted" : "submitted"} for admin review.` });
    }
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to update course", error: error.message }); }
});

router.delete("/courses/:courseId", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (await Enrollment.exists({ course: course._id })) return res.status(409).json({ message: "Archive courses that already have students" });
    await course.deleteOne();
    return res.status(204).end();
  } catch (error) { return res.status(500).json({ message: "Unable to delete course", error: error.message }); }
});

router.post("/courses/:courseId/lessons", receiveLessonFiles, async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const externalVideoUrl = String(req.body.videoUrl || "").trim();
    const videoFile = req.files?.video?.[0];
    const resourceFiles = req.files?.resources || [];
    if (!req.body.title || (!videoFile && !externalVideoUrl && !resourceFiles.length)) return res.status(400).json({ message: "Lesson title and at least one video, document, or image are required" });
    if (externalVideoUrl) {
      try {
        const parsed = new URL(externalVideoUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ message: "Enter a valid YouTube, Facebook, Google Drive, or direct video link" });
      }
    }
    const seconds = Math.max(0, Math.round(Number(req.body.durationSeconds) || 0));
    const duration = seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Provider managed";
    const materialVideo = resourceFiles.find((file) => path.extname(file.originalname).toLowerCase() === ".mp4");
    const videoUrl = videoFile ? `${req.protocol}://${req.get("host")}/uploads/course-videos/${videoFile.filename}` : externalVideoUrl || (materialVideo ? `${req.protocol}://${req.get("host")}/uploads/lesson-resources/${materialVideo.filename}` : "");
    const resources = resourceFiles.map((file) => ({ originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype, size: file.size, url: `${req.protocol}://${req.get("host")}/uploads/lesson-resources/${file.filename}` }));
    course.lessons.push({ title: req.body.title, description: req.body.description || "", duration, videoUrl, resources });
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.status(201).json(course);
  } catch (error) {
    [...(req.files?.video || []), ...(req.files?.resources || [])].forEach((file) => fs.unlink(file.path, () => {}));
    return res.status(500).json({ message: "Unable to add lesson", error: error.message });
  }
});

router.patch("/courses/:courseId/lessons/:lessonId", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    ["title", "description", "duration", "videoUrl"].forEach((key) => { if (req.body[key] !== undefined) lesson[key] = req.body[key]; });
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to update lesson", error: error.message }); }
});

router.delete("/courses/:courseId/lessons/:lessonId", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    if (lesson.videoUrl?.includes("/uploads/course-videos/")) fs.unlink(path.join(videoDirectory, path.basename(lesson.videoUrl)), () => {});
    lesson.resources.forEach((resource) => fs.unlink(path.join(lessonResourceDirectory, path.basename(resource.storedName)), () => {}));
    lesson.deleteOne();
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to delete lesson", error: error.message }); }
});

router.get("/students", async (req, res) => {
  try {
    const { enrollments } = await tutorData(req.user._id);
    return res.json(enrollments.map((item) => ({ _id: item._id, student: item.student, course: { _id: item.course._id, name: item.course.name }, enrolledAt: item.createdAt, lastAccessedAt: item.lastAccessedAt, completedLessons: item.completedLessons.length, totalLessons: item.course.lessons.length, progress: percent(item), status: percent(item) === 100 ? "Completed" : percent(item) ? "In Progress" : "Not Started" })));
  } catch (error) { return res.status(500).json({ message: "Unable to load students", error: error.message }); }
});

router.get("/analytics", async (req, res) => {
  try {
    const { courses, enrollments } = await tutorData(req.user._id);
    const rows = courses.map((course) => {
      const items = enrollments.filter((item) => String(item.course._id) === String(course._id));
      const averageProgress = items.length ? Math.round(items.reduce((sum, item) => sum + percent(item), 0) / items.length) : 0;
      return { courseId: course._id, name: course.name, enrollments: items.length, averageProgress, completionRate: items.length ? Math.round((items.filter((item) => percent(item) === 100).length / items.length) * 100) : 0 };
    });
    const totalEnrollments = enrollments.length;
    const uniqueStudents = new Set(enrollments.map((item) => String(item.student._id))).size;
    return res.json({ totalStudents: uniqueStudents, totalEnrollments, averageProgress: totalEnrollments ? Math.round(enrollments.reduce((sum, item) => sum + percent(item), 0) / totalEnrollments) : 0, completionRate: totalEnrollments ? Math.round((enrollments.filter((item) => percent(item) === 100).length / totalEnrollments) * 100) : 0, mostPopularCourse: [...rows].sort((a, b) => b.enrollments - a.enrollments)[0]?.name || "No enrollments yet", courses: rows });
  } catch (error) { return res.status(500).json({ message: "Unable to load analytics", error: error.message }); }
});

router.get("/profile", async (req, res) => {
  const user = await User.findById(req.user._id).select("name email tutorProfile");
  return res.json(user);
});

router.patch("/profile", async (req, res) => {
  try {
    const profile = {};
    ["photoUrl", "phoneNumber", "bio", "expertise", "education", "teachingExperience"].forEach((key) => { if (req.body[key] !== undefined) profile[`tutorProfile.${key}`] = String(req.body[key]).trim(); });
    const update = { ...profile };
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true }).select("name email tutorProfile");
    return res.json(user);
  } catch (error) { return res.status(500).json({ message: "Unable to update profile", error: error.message }); }
});

module.exports = router;

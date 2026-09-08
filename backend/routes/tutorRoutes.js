const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const User = require("../models/User");
const { notifyCourseSubmitted } = require("../services/notificationService");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { revokeUserSessions } = require("../services/sessionService");
const { validatePassword } = require("../utils/passwordSecurity");

const router = express.Router();
const LESSON_SUMMARY_MAX_LENGTH = 5000;
const LESSON_TRANSCRIPT_MAX_LENGTH = 50000;
const MAX_REFERENCES = 20;
const mediaExtensions = new Set([".mp4", ".webm", ".ogv", ".mov", ".m4v", ".mp3", ".wav", ".m4a", ".ogg"]);
const videoDirectory = path.join(__dirname, "..", "uploads", "course-videos");
fs.mkdirSync(videoDirectory, { recursive: true });
const posterDirectory = path.join(__dirname, "..", "uploads", "lesson-posters");
fs.mkdirSync(posterDirectory, { recursive: true });
const execFileAsync = promisify(execFile);
const lessonResourceDirectory = path.join(__dirname, "..", "uploads", "lesson-resources");
fs.mkdirSync(lessonResourceDirectory, { recursive: true });
function safeResourcePath(storedName) {
  if (typeof storedName !== "string" || !storedName || path.basename(storedName) !== storedName) throw new Error("unsafe_path");
  const resolved = path.resolve(lessonResourceDirectory, storedName);
  if (!resolved.startsWith(`${path.resolve(lessonResourceDirectory)}${path.sep}`)) throw new Error("unsafe_path");
  return resolved;
}
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
const profilePhotoDirectory = path.join(__dirname, "..", "uploads", "profile-photos");
fs.mkdirSync(profilePhotoDirectory, { recursive: true });
const uploadProfilePhoto = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, profilePhotoDirectory),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});
const uploadLessonFiles = multer({
  storage: multer.diskStorage({
    destination: (_req, file, callback) => callback(null, file.fieldname === "video" ? videoDirectory : lessonResourceDirectory),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
    const documentExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"]);
    const media = mediaExtensions.has(extension) && /^(video|audio)\//.test(file.mimetype);
    if (file.fieldname === "video" && !media) return callback(Object.assign(new Error("Main lesson media must be a supported video or audio file"), { status: 400 }));
    const allowed = (imageExtensions.has(extension) && file.mimetype.startsWith("image/"))
      || documentExtensions.has(extension)
      || media;
    if (!allowed) return callback(Object.assign(new Error("Unsupported lesson resource type"), { status: 400 }));
    return callback(null, true);
  },
});
const receiveLessonFiles = uploadLessonFiles.fields([{ name: "video", maxCount: 1 }, { name: "resources", maxCount: 10 }]);
router.use(authenticateToken);
router.use(requireRole("tutor"));

function lessonContentFields(body, partial = false) {
  const result = {};
  for (const [field, limit, label] of [["summary", LESSON_SUMMARY_MAX_LENGTH, "Lesson summary"], ["transcript", LESSON_TRANSCRIPT_MAX_LENGTH, "Lesson transcript"]]) {
    if (partial && body[field] === undefined) continue;
    if (body[field] !== undefined && typeof body[field] !== "string") return { error: `${label} must be text` };
    const value = String(body[field] || "").trim();
    if (value.length > limit) return { error: `${label} cannot exceed ${limit} characters` };
    result[field] = value;
  }
  return { values: result };
}

function referenceFields(body, partial = false) {
  if (partial && body.references === undefined) return {};
  let input = body.references ?? [];
  if (typeof input === "string") {
    try { input = JSON.parse(input); } catch { input = input.split(/\r?\n/).filter(Boolean).map((url) => ({ url })); }
  }
  if (!Array.isArray(input) || input.length > MAX_REFERENCES) return { error: `References must contain at most ${MAX_REFERENCES} links` };
  const references = [];
  for (const item of input) {
    const url = String(typeof item === "string" ? item : item?.url || "").trim();
    try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); references.push({ label: String(item?.label || parsed.hostname).trim().slice(0, 200), url }); }
    catch { return { error: "Each reference must be a valid HTTP or HTTPS URL" }; }
  }
  return { references };
}

function mediaDescriptor(file, storage = "course-videos", resourceId = null) {
  return { originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype, size: file.size, url: `/uploads/${storage}/${file.filename}`, storage, resourceId };
}

async function createLessonPoster(file) {
  if (!file || !/^video\//.test(file.mimetype || "")) return "";
  if (!fs.existsSync(file.path)) return "";
  try {
    await execFileAsync("/usr/bin/qlmanage", ["-t", "-s", "640", "-o", posterDirectory, file.path], { timeout: 3000 });
    const generated = path.join(posterDirectory, `${path.basename(file.path)}.png`);
    if (!fs.existsSync(generated)) return "";
    const filename = `${crypto.randomUUID()}.png`;
    fs.renameSync(generated, path.join(posterDirectory, filename));
    return `/uploads/lesson-posters/${filename}`;
  } catch { return ""; }
}

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
      await notifyCourseSubmitted({ user: req.user._id, course, resubmitted });
    }
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to update course", error: error.message }); }
});

router.delete("/courses/:courseId", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (await Enrollment.exists({ course: course._id })) return res.status(409).json({ message: "Archive courses that already have students" });
    await LearningSignal.deleteMany({ course: course._id });
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
    const lessonContent = lessonContentFields(req.body);
    const referenceContent = referenceFields(req.body);
    if (lessonContent.error) {
      [...(req.files?.video || []), ...resourceFiles].forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ message: lessonContent.error });
    }
    if (referenceContent.error) return res.status(400).json({ message: referenceContent.error });
    if (!req.body.title || (!videoFile && !externalVideoUrl && !resourceFiles.length && !referenceContent.references.length)) return res.status(400).json({ message: "Lesson title and at least one video, resource, or reference are required" });
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
    const references = [...referenceContent.references];
    if (externalVideoUrl && !references.some((item) => item.url === externalVideoUrl)) references.push({ label: new URL(externalVideoUrl).hostname, url: externalVideoUrl });
    const resources = resourceFiles.map((file) => ({ originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype, size: file.size, url: `${req.protocol}://${req.get("host")}/uploads/lesson-resources/${file.filename}` }));
    course.lessons.push({ title: req.body.title, description: req.body.description || "", ...lessonContent.values, duration, videoUrl: "", primaryMedia: videoFile ? mediaDescriptor(videoFile) : undefined, posterUrl: await createLessonPoster(videoFile), primaryMediaRemoved: false, references, resources });
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.status(201).json(await Course.findById(course._id));
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
    const lessonContent = lessonContentFields(req.body, true);
    const referenceContent = referenceFields(req.body, true);
    if (lessonContent.error) return res.status(400).json({ message: lessonContent.error });
    if (referenceContent.error) return res.status(400).json({ message: referenceContent.error });
    ["title", "description", "duration"].forEach((key) => { if (req.body[key] !== undefined) lesson[key] = req.body[key]; });
    Object.assign(lesson, lessonContent.values);
    if (referenceContent.references) lesson.references = referenceContent.references;
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to update lesson", error: error.message }); }
});

router.post("/courses/:courseId/lessons/:lessonId/main-media", uploadLessonFiles.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a supported main video or audio file" });
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    if (!lesson) { fs.unlink(req.file.path, () => {}); return res.status(404).json({ message: "Lesson not found" }); }
    const previous = lesson.primaryMedia?.storedName && lesson.primaryMedia.storage === "course-videos" ? lesson.primaryMedia.storedName : null;
    lesson.primaryMedia = mediaDescriptor(req.file);
    lesson.posterUrl = await createLessonPoster(req.file);
    lesson.primaryMediaRemoved = false;
    await course.save();
    if (previous) fs.unlink(path.join(videoDirectory, path.basename(previous)), () => {});
    return res.json(course);
  } catch (error) { if (req.file) fs.unlink(req.file.path, () => {}); return res.status(500).json({ message: "Unable to replace main lesson media" }); }
});

router.patch("/courses/:courseId/lessons/:lessonId/main-media", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    const resource = lesson?.resources.id(req.body.resourceId);
    if (!resource || !(/^(video|audio)\//.test(resource.mimeType || "") || mediaExtensions.has(path.extname(resource.originalName).toLowerCase()))) return res.status(400).json({ message: "Choose an uploaded video or audio resource" });
    const previous = lesson.primaryMedia?.storage === "course-videos" ? lesson.primaryMedia.storedName : "";
    lesson.primaryMedia = { ...resource.toObject(), storage: "lesson-resources", resourceId: resource._id };
    lesson.primaryMediaRemoved = false;
    await course.save();
    if (previous) fs.unlink(path.join(videoDirectory, path.basename(previous)), () => {});
    return res.json(course);
  } catch { return res.status(500).json({ message: "Unable to select main lesson media" }); }
});

router.delete("/courses/:courseId/lessons/:lessonId/main-media", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    const storedName = lesson.primaryMedia?.storage === "course-videos" ? lesson.primaryMedia.storedName : "";
    lesson.primaryMedia = undefined;
    lesson.primaryMediaRemoved = true;
    lesson.videoUrl = "";
    await course.save();
    if (storedName) fs.unlink(path.join(videoDirectory, path.basename(storedName)), () => {});
    return res.json(course);
  } catch { return res.status(500).json({ message: "Unable to remove main lesson media" }); }
});

router.post("/courses/:courseId/lessons/:lessonId/resources", uploadLessonFiles.array("resources", 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: "Choose at least one supporting resource" });
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    if (!lesson) { files.forEach((file) => fs.unlink(file.path, () => {})); return res.status(404).json({ message: "Lesson not found" }); }
    for (const file of files) {
      lesson.resources.push(mediaDescriptor(file, "lesson-resources"));
    }
    await course.save();
    return res.json(await Course.findById(course._id));
  } catch (error) { (req.files || []).forEach((file) => fs.unlink(file.path, () => {})); return res.status(500).json({ message: "Unable to add lesson resources" }); }
});

router.delete("/courses/:courseId/lessons/:lessonId", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    if (lesson.primaryMedia?.storage === "course-videos" && lesson.primaryMedia.storedName) fs.unlink(path.join(videoDirectory, path.basename(lesson.primaryMedia.storedName)), () => {});
    else if (lesson.videoUrl?.includes("/uploads/course-videos/")) fs.unlink(path.join(videoDirectory, path.basename(lesson.videoUrl)), () => {});
    lesson.resources.forEach((resource) => { try { fs.unlink(safeResourcePath(resource.storedName), () => {}); } catch { /* Invalid legacy paths are never followed. */ } });
    lesson.deleteOne();
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    await LearningSignal.deleteMany({ course: course._id, lessonId: req.params.lessonId });
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to delete lesson", error: error.message }); }
});

router.delete("/courses/:courseId/lessons/:lessonId/resources/:resourceId", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    const resource = lesson?.resources.id(req.params.resourceId);
    if (!resource) return res.status(404).json({ message: "Lesson resource not found" });
    if (String(lesson.primaryMedia?.resourceId || "") === String(resource._id)) lesson.primaryMedia = undefined;
    try { await fs.promises.unlink(safeResourcePath(resource.storedName)); } catch (error) { if (error.code !== "ENOENT" && error.message !== "unsafe_path") console.error("Delete lesson resource file error:", error); }
    resource.deleteOne();
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to delete lesson resource" }); }
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
    const courseIds = courses.map((course) => course._id);
    const signals = courseIds.length
      ? await LearningSignal.find({ course: { $in: courseIds }, "aiPrediction.prediction": { $in: ["clear", "confused"] } }).lean()
      : [];
    const validSignals = signals.filter((signal) => {
      const prediction = signal.aiPrediction;
      return courses.some((course) => String(course._id) === String(signal.course) && course.lessons.some((lesson) => String(lesson._id) === String(signal.lessonId)))
        && prediction
        && ["clear", "confused"].includes(prediction.prediction)
        && Number.isFinite(prediction.confusionProbability)
        && Number.isFinite(prediction.clearProbability)
        && prediction.confusionProbability >= 0 && prediction.confusionProbability <= 1
        && prediction.clearProbability >= 0 && prediction.clearProbability <= 1;
    });
    const signalsByLesson = new Map();
    validSignals.forEach((signal) => {
      const key = `${signal.course}:${signal.lessonId}`;
      const list = signalsByLesson.get(key) || [];
      list.push(signal);
      signalsByLesson.set(key, list);
    });
    const rows = courses.map((course) => {
      const items = enrollments.filter((item) => String(item.course._id) === String(course._id));
      const averageProgress = items.length ? Math.round(items.reduce((sum, item) => sum + percent(item), 0) / items.length) : 0;
      return { courseId: course._id, name: course.name, enrollments: items.length, averageProgress, completionRate: items.length ? Math.round((items.filter((item) => percent(item) === 100).length / items.length) * 100) : 0 };
    });
    const totalEnrollments = enrollments.length;
    const uniqueStudents = new Set(enrollments.map((item) => String(item.student._id))).size;
    const heatmapCourses = courses.map((course) => {
      const lessons = course.lessons.map((lesson, index) => {
        const items = signalsByLesson.get(`${course._id}:${lesson._id}`) || [];
        const confused = items.filter((item) => item.aiPrediction.prediction === "confused").length;
        const latestItem = items.filter((item) => item.aiPrediction.predictedAt && Number.isFinite(new Date(item.aiPrediction.predictedAt).getTime())).sort((a, b) => new Date(b.aiPrediction.predictedAt) - new Date(a.aiPrediction.predictedAt))[0];
        const latest = latestItem?.aiPrediction.predictedAt || null;
        return { lessonId: lesson._id, lessonOrder: index + 1, lessonTitle: lesson.title, predictionCount: items.length, predictedClear: items.length - confused, predictedConfused: confused, confusionRate: items.length ? Math.round((confused / items.length) * 100) : null, modelVersion: latestItem?.aiPrediction.modelVersion || null, latestPredictionAt: latest };
      });
      const analyzedLessons = lessons.filter((lesson) => lesson.predictionCount > 0);
      const coursePredictions = analyzedLessons.reduce((sum, lesson) => sum + lesson.predictionCount, 0);
      const courseConfused = analyzedLessons.reduce((sum, lesson) => sum + lesson.predictedConfused, 0);
      const totalStudentsAnalyzed = new Set(validSignals.filter((signal) => String(signal.course) === String(course._id)).map((signal) => String(signal.student))).size;
      return { courseId: course._id, courseTitle: course.name, courseCover: course.thumbnail || "", category: course.category || "General Education", predictionLessonCount: analyzedLessons.length, totalStudentsAnalyzed, overallConfusionRate: coursePredictions >= 5 ? Math.round((courseConfused / coursePredictions) * 100) : null, lessons: analyzedLessons };
    });
    return res.json({ generatedAt: new Date().toISOString(), totalStudentsAnalyzed: new Set(validSignals.filter((signal) => signal.student).map((signal) => String(signal.student))).size, totalStudents: uniqueStudents, totalEnrollments, averageProgress: totalEnrollments ? Math.round(enrollments.reduce((sum, item) => sum + percent(item), 0) / totalEnrollments) : 0, completionRate: totalEnrollments ? Math.round((enrollments.filter((item) => percent(item) === 100).length / totalEnrollments) * 100) : 0, mostPopularCourse: [...rows].sort((a, b) => b.enrollments - a.enrollments)[0]?.name || "No enrollments yet", courses: rows, heatmapCourses });
  } catch (error) { return res.status(500).json({ message: "Unable to load analytics", error: error.message }); }
});

router.get("/profile", async (req, res) => {
  const user = await User.findById(req.user._id).select("name email role accountStatus tutorProfile");
  return res.json(user);
});

router.patch("/profile", uploadProfilePhoto.single("photo"), async (req, res) => {
  try {
    const limits = { name: 120, phoneNumber: 30, expertise: 500, education: 2000, teachingExperience: 2000, bio: 3000 };
    const invalid = Object.entries(limits).find(([key, limit]) => req.body[key] !== undefined && (typeof req.body[key] !== "string" || req.body[key].trim().length > limit));
    const phone = typeof req.body.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";
    const invalidPhone = phone && (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7 || phone.replace(/\D/g, "").length > 15);
    if (invalid || invalidPhone || (req.body.name !== undefined && !String(req.body.name).trim())) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: invalid ? `${invalid[0]} must be text with at most ${invalid[1]} characters.` : invalidPhone ? "Phone number must contain 7–15 digits and valid phone punctuation." : "Full name is required." });
    }
    const profile = {};
    ["phoneNumber", "bio", "expertise", "education", "teachingExperience"].forEach((key) => { if (req.body[key] !== undefined) profile[`tutorProfile.${key}`] = String(req.body[key]).trim(); });
    if (req.file) profile["tutorProfile.photoUrl"] = `${req.protocol}://${req.get("host")}/uploads/profile-photos/${req.file.filename}`;
    const update = { ...profile };
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true }).select("name email role accountStatus tutorProfile");
    return res.json(user);
  } catch (error) { return res.status(500).json({ message: "Unable to update profile", error: error.message }); }
});

router.patch("/profile/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") return res.status(400).json({ message: "Current and new passwords are required" });
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: "Current password is incorrect" });
    if (await bcrypt.compare(newPassword, user.password)) return res.status(400).json({ message: "Choose a password different from your temporary password" });
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await revokeUserSessions(user._id, "password_changed");
    return res.json({ message: "Password changed successfully. Please log in again." });
  } catch (error) { return res.status(500).json({ message: "Unable to change password" }); }
});

module.exports = router;

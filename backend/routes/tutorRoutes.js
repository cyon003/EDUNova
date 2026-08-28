const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const LessonResourceChunk = require("../models/LessonResourceChunk");
const { extractionLimits, processResourceExtraction, safeResourcePath, searchableContentType, validateSearchableFile } = require("../services/lessonResourceExtraction");
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
    await LessonResourceChunk.deleteMany({ course: course._id });
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
    const oversizedSearchable = resourceFiles.find((file) => searchableContentType({ originalName: file.originalname, mimeType: file.mimetype }) && file.size > extractionLimits().maxFileBytes);
    if (oversizedSearchable) {
      [...(req.files?.video || []), ...resourceFiles].forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(413).json({ message: "A searchable lesson resource exceeds the extraction size limit" });
    }
    const invalidSearchable = (await Promise.all(resourceFiles.map(async (file) => {
      const descriptor = { originalName: file.originalname, mimeType: file.mimetype };
      return searchableContentType(descriptor) && !(await validateSearchableFile(descriptor, file.path));
    }))).some(Boolean);
    if (invalidSearchable) {
      [...(req.files?.video || []), ...resourceFiles].forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ message: "A lesson resource does not match its declared PDF, DOCX, or TXT format" });
    }
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
    const resources = resourceFiles.map((file) => {
      const searchable = searchableContentType({ originalName: file.originalname, mimeType: file.mimetype });
      return { originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype, size: file.size, url: `${req.protocol}://${req.get("host")}/uploads/lesson-resources/${file.filename}`, extractionStatus: searchable ? "pending" : null };
    });
    course.lessons.push({ title: req.body.title, description: req.body.description || "", ...lessonContent.values, duration, videoUrl: "", primaryMedia: videoFile ? mediaDescriptor(videoFile) : undefined, primaryMediaRemoved: false, references, resources });
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    const lesson = course.lessons[course.lessons.length - 1];
    await Promise.all(lesson.resources.filter((resource) => resource.extractionStatus === "pending").map((resource) => processResourceExtraction({ courseId: course._id, lessonId: lesson._id, resourceId: resource._id })));
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
    const oversized = files.find((file) => searchableContentType({ originalName: file.originalname, mimeType: file.mimetype }) && file.size > extractionLimits().maxFileBytes);
    if (oversized) { files.forEach((file) => fs.unlink(file.path, () => {})); return res.status(413).json({ message: "A searchable lesson resource exceeds the extraction size limit" }); }
    const addedResources = [];
    for (const file of files) {
      const descriptor = { originalName: file.originalname, mimeType: file.mimetype };
      if (searchableContentType(descriptor) && !(await validateSearchableFile(descriptor, file.path))) { files.forEach((item) => fs.unlink(item.path, () => {})); return res.status(400).json({ message: "A lesson resource does not match its declared PDF, DOCX, or TXT format" }); }
      lesson.resources.push({ ...mediaDescriptor(file, "lesson-resources"), extractionStatus: searchableContentType(descriptor) ? "pending" : null });
      addedResources.push(lesson.resources[lesson.resources.length - 1]);
    }
    await course.save();
    await Promise.all(addedResources.filter((resource) => resource.extractionStatus === "pending").map((resource) => processResourceExtraction({ courseId: course._id, lessonId: lesson._id, resourceId: resource._id })));
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
    await LessonResourceChunk.deleteMany({ course: course._id, lesson: lesson._id });
    lesson.deleteOne();
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to delete lesson", error: error.message }); }
});

router.delete("/courses/:courseId/lessons/:lessonId/resources/:resourceId", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    const resource = lesson?.resources.id(req.params.resourceId);
    if (!resource) return res.status(404).json({ message: "Lesson resource not found" });
    await LessonResourceChunk.deleteMany({ resource: resource._id });
    if (String(lesson.primaryMedia?.resourceId || "") === String(resource._id)) lesson.primaryMedia = undefined;
    try { await fs.promises.unlink(safeResourcePath(resource.storedName)); } catch (error) { if (error.code !== "ENOENT" && error.message !== "unsafe_path") console.error("Delete lesson resource file error:", error); }
    resource.deleteOne();
    if (course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    return res.json(course);
  } catch (error) { return res.status(500).json({ message: "Unable to delete lesson resource" }); }
});

router.post("/courses/:courseId/lessons/:lessonId/resources/:resourceId/retry-extraction", async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(req.params.lessonId);
    const resource = lesson?.resources.id(req.params.resourceId);
    if (!resource) return res.status(404).json({ message: "Lesson resource not found" });
    if (!searchableContentType(resource)) return res.status(400).json({ message: "This resource does not support text extraction" });
    if (["pending", "processing"].includes(resource.extractionStatus)) return res.status(409).json({ message: "Text extraction is already in progress" });
    await Course.updateOne({ _id: course._id }, { $set: { "lessons.$[lesson].resources.$[resource].extractionStatus": "pending", "lessons.$[lesson].resources.$[resource].extractionFailureReason": "" } }, { arrayFilters: [{ "lesson._id": lesson._id }, { "resource._id": resource._id }] });
    const result = await processResourceExtraction({ courseId: course._id, lessonId: lesson._id, resourceId: resource._id });
    const updated = await Course.findById(course._id);
    const updatedResource = updated.lessons.id(lesson._id).resources.id(resource._id);
    return res.status(result.status === "completed" ? 200 : 422).json({ message: result.status === "completed" ? "Text extraction completed" : result.reason, resource: updatedResource });
  } catch (error) { return res.status(500).json({ message: "Unable to retry text extraction" }); }
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

router.patch("/profile", uploadProfilePhoto.single("photo"), async (req, res) => {
  try {
    const profile = {};
    ["phoneNumber", "bio", "expertise", "education", "teachingExperience"].forEach((key) => { if (req.body[key] !== undefined) profile[`tutorProfile.${key}`] = String(req.body[key]).trim(); });
    if (req.file) profile["tutorProfile.photoUrl"] = `${req.protocol}://${req.get("host")}/uploads/profile-photos/${req.file.filename}`;
    const update = { ...profile };
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true }).select("name email tutorProfile");
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

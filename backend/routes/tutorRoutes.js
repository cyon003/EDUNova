const PlatformSetting = require("../models/PlatformSetting");
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { uploadDirectory } = require("../config/storage");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const ConfusionEvent = require("../models/ConfusionEvent");
const LessonVideoExposure = require("../models/LessonVideoExposure");
const { topicAnalytics, topicEventPipeline } = require("../services/topicAnalyticsService");
const Note = require("../models/Note");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { notifyCourseSubmitted } = require("../services/notificationService");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { revokeUserSessions } = require("../services/sessionService");
const { validatePassword } = require("../utils/passwordSecurity");
const { statedDurationSeconds } = require("../services/lessonWatchService");
const { sendQuizMediaFile, QUIZ_MEDIA_TYPES, MAX_IMAGE_BYTES, MAX_AUDIO_BYTES, newStoredName, describeQuizMedia, quizMediaNames, deleteQuizMediaFiles, quizMediaDirectory } = require("../utils/quizMedia");

const { topicFields } = require("../utils/lessonTopics");
const router = express.Router();
const LESSON_SUMMARY_MAX_LENGTH = 5000;
const LESSON_TRANSCRIPT_MAX_LENGTH = 50000;
const MAX_REFERENCES = 20;
const mediaExtensions = new Set([".mp4", ".webm", ".ogv", ".mov", ".m4v", ".mp3", ".wav", ".m4a", ".ogg"]);
const videoDirectory = uploadDirectory("course-videos");
const posterDirectory = uploadDirectory("lesson-posters");
const execFileAsync = promisify(execFile);
const lessonResourceDirectory = uploadDirectory("lesson-resources");
function safeResourcePath(storedName) {
  if (typeof storedName !== "string" || !storedName || path.basename(storedName) !== storedName) throw new Error("unsafe_path");
  const resolved = path.resolve(lessonResourceDirectory, storedName);
  if (!resolved.startsWith(`${path.resolve(lessonResourceDirectory)}${path.sep}`)) throw new Error("unsafe_path");
  return resolved;
}
const coverDirectory = uploadDirectory("course-covers");
const uploadCover = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, coverDirectory),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith("image/")),
});
const profilePhotoDirectory = uploadDirectory("profile-photos");
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
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
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

function quizFields(body, partial = false, courseId = null) {
  if (partial && body.quiz === undefined) {
    return {};
  }

  let quiz = body.quiz;

  if (typeof quiz === "string") {
    try {
      quiz = JSON.parse(quiz);
    } catch {
      return { error: "Quiz data is invalid" };
    }
  }

  if (quiz === null || quiz === undefined || quiz === "") {
    return { values: { quiz: null } };
  }

  if (typeof quiz !== "object" || Array.isArray(quiz)) {
    return { error: "Quiz must be an object" };
  }

  const title = String(quiz.title || "Lesson Quiz").trim();

  if (title.length > 200) {
    return { error: "Quiz title cannot exceed 200 characters" };
  }

  if (!Array.isArray(quiz.questions)) {
    return { error: "Quiz questions must be an array" };
  }

  if (quiz.questions.length > 20) {
    return { error: "A quiz cannot contain more than 20 questions" };
  }

  if (quiz.questions.length === 0) {
    return { error: "Add at least one question to the quiz, or remove the quiz" };
  }

  const questions = [];

  for (const [index, item] of quiz.questions.entries()) {
    if (!item || typeof item !== "object") {
      return { error: `Question ${index + 1} is invalid` };
    }

    const question = String(item.question || "").trim();

    if (!question) {
      return { error: `Question ${index + 1} cannot be empty` };
    }

    const type = item.type || "multiple_choice";

    if (!["multiple_choice", "true_false"].includes(type)) {
      return { error: `Question ${index + 1} has an invalid type` };
    }

    let options = Array.isArray(item.options)
      ? item.options.map((option) => String(option?.text ?? option ?? "").trim())
      : [];

    if (type === "true_false") {
      options = ["True", "False"];
    }

    if (type === "multiple_choice") {
      if (options.length < 2 || options.length > 5) {
        return {
          error: `Question ${index + 1} must have between 2 and 5 choices`,
        };
      }

      if (options.some((option) => !option)) {
        return {
          error: `Question ${index + 1} contains an empty choice`,
        };
      }
    }

    const correctOption = Number(item.correctOption);

    if (
      !Number.isInteger(correctOption) ||
      correctOption < 0 ||
      correctOption >= options.length
    ) {
      return {
        error: `Question ${index + 1} has an invalid correct answer`,
      };
    }

    const attachment = describeQuizMedia(item.media, courseId);

    if (attachment.error) {
      return { error: `Question ${index + 1}: ${attachment.error}` };
    }

    questions.push({
      question,
      type,
      options: options.map((text) => ({ text })),
      correctOption,
      ...(attachment.media ? { media: attachment.media } : {}),
    });
  }

  return {
    values: {
      quiz: {
        title,
        questions,
      },
    },
  };
}

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
    if (req.body.action === "publish") {
      const settings = await PlatformSetting.findOne({ key: "platform" }).lean();
      update.moderationStatus = settings?.approvalRequired === false ? "published" : "pending";
    }
    if (req.body.action === "unpublish") update.moderationStatus = "unpublished";
    const currentCourse = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id }).select("moderationStatus name tutor");
    if (!currentCourse) return res.status(404).json({ message: "Course not found" });
    if (!req.body.action && Object.keys(update).length && currentCourse.moderationStatus !== "rejected") update.moderationStatus = "unpublished";
    const course = await Course.findOneAndUpdate({ _id: req.params.courseId, tutor: req.user._id }, { $set: update }, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (update.moderationStatus === "pending") {
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
    if (course.moderationStatus !== "unpublished") {
      return res.status(409).json({ message: "Unpublish this course before deleting it" });
    }
    await Promise.all([
      Enrollment.deleteMany({ course: course._id }),
      LearningSignal.deleteMany({ course: course._id }),
      Note.deleteMany({ course: course._id }),
      Notification.deleteMany({ course: course._id }),
    ]);
    await course.deleteOne();
    return res.status(204).end();
  } catch (error) { return res.status(500).json({ message: "Unable to delete course", error: error.message }); }
});

// ---- Quiz question attachments (picture or audio) ----
async function ownedCourse(req, res, next) {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    if (!course) return res.status(404).json({ message: "Course not found" });
    req.ownedCourse = course;
    return next();
  } catch { return res.status(404).json({ message: "Course not found" }); }
}

const uploadQuizMedia = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, quizMediaDirectory()),
    filename: (req, file, callback) => callback(null, newStoredName(req.params.courseId, file.originalname)),
  }),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const type = QUIZ_MEDIA_TYPES[path.extname(file.originalname).toLowerCase()];
    if (!type || !file.mimetype.startsWith(`${type.kind}/`)) {
      return callback(Object.assign(new Error("Attach a picture (JPG, PNG, GIF, WebP) or an audio file (MP3, WAV, M4A, OGG)"), { status: 400 }));
    }
    return callback(null, true);
  },
}).single("file");

function receiveQuizMedia(req, res, next) {
  uploadQuizMedia(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "That file is too large. Pictures can be up to 5 MB and audio up to 15 MB" });
    return res.status(error.status || 400).json({ message: error.status ? error.message : "Unable to upload the attachment" });
  });
}

router.post("/courses/:courseId/quiz-media", ownedCourse, receiveQuizMedia, (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Choose a picture or audio file" });
  const type = QUIZ_MEDIA_TYPES[path.extname(req.file.filename).toLowerCase()];
  if (type.kind === "image" && req.file.size > MAX_IMAGE_BYTES) {
    fs.unlink(req.file.path, () => {});
    return res.status(413).json({ message: "Pictures can be up to 5 MB" });
  }
  return res.status(201).json({ media: { originalName: req.file.originalname.slice(0, 200), storedName: req.file.filename, mimeType: type.mime, size: req.file.size, kind: type.kind } });
});

router.get("/courses/:courseId/quiz-media/:storedName", ownedCourse, (req, res) => {
  const described = describeQuizMedia({ storedName: req.params.storedName }, req.ownedCourse._id);
  if (described.error) return res.status(404).json({ message: "Attachment not found" });
  return sendQuizMediaFile(res, req.params.storedName, described.media.mimeType);
});

// Removes an uploaded attachment that no saved quiz uses (for example when the
// tutor removes it before saving). Attachments that a saved quiz still uses are
// left alone; they are cleaned up when the quiz is saved without them.
router.delete("/courses/:courseId/quiz-media/:storedName", ownedCourse, (req, res) => {
  const described = describeQuizMedia({ storedName: req.params.storedName }, req.ownedCourse._id);
  if (described.error) return res.status(404).json({ message: "Attachment not found" });
  const inUse = req.ownedCourse.lessons.some((lesson) => quizMediaNames(lesson.quiz).includes(req.params.storedName));
  if (!inUse) deleteQuizMediaFiles([req.params.storedName]);
  return res.status(204).end();
});

router.post("/courses/:courseId/lessons", receiveLessonFiles, async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, tutor: req.user._id });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const externalVideoUrl = String(req.body.videoUrl || "").trim();
    const videoFile = req.files?.video?.[0];
    const resourceFiles = req.files?.resources || [];
    const topicContent = topicFields(req.body, [], Math.round(Number(req.body.durationSeconds)));
    if (topicContent.error) {
      [...(req.files?.video || []), ...resourceFiles].forEach(file => fs.unlink(file.path, () => {}));
      return res.status(400).json({ message: topicContent.error });
    }
    const lessonContent = lessonContentFields(req.body);
    const referenceContent = referenceFields(req.body);
    const quizContent = quizFields(req.body, false, course._id);
    if (lessonContent.error) {
      [...(req.files?.video || []), ...resourceFiles].forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ message: lessonContent.error });
    }
    if (referenceContent.error) return res.status(400).json({ message: referenceContent.error });
    if (quizContent.error) {
       [...(req.files?.video || []), ...resourceFiles].forEach((file) => {
        fs.unlink(file.path, () => {});
      });

      return res.status(400).json({ message: quizContent.error });
    }
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
    course.lessons.push({ title: req.body.title, description: req.body.description || "", ...lessonContent.values, ...topicContent.values, duration, videoUrl: "", primaryMedia: videoFile ? mediaDescriptor(videoFile) : undefined, posterUrl: await createLessonPoster(videoFile), primaryMediaRemoved: false, references, resources, quiz: quizContent.values.quiz });
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
    const topicContent = topicFields(req.body, lesson.topics || []);
    if (topicContent.error) return res.status(400).json({ message: topicContent.error });
    const lessonContent = lessonContentFields(req.body, true);
    const referenceContent = referenceFields(req.body, true);
    const quizContent = quizFields(req.body, true, course._id);
    if (lessonContent.error) return res.status(400).json({ message: lessonContent.error });
    if (referenceContent.error) return res.status(400).json({ message: referenceContent.error });
    if (quizContent.error) return res.status(400).json({ message: quizContent.error });
    if (req.body.duration !== undefined && req.body.duration !== lesson.duration && !statedDurationSeconds(req.body.duration)) {
      return res.status(400).json({ message: "Video duration must be minutes:seconds" });
    }
    const contentChanged = ["title", "description"].some((key) => req.body[key] !== undefined && String(req.body[key]) !== String(lesson[key] || ""))
      || ["summary", "transcript"].some((key) => lessonContent.values[key] !== undefined && lessonContent.values[key] !== String(lesson[key] || ""))
      || (referenceContent.references !== undefined && JSON.stringify(referenceContent.references.map(({ label, url }) => ({ label: label || "", url }))) !== JSON.stringify((lesson.references || []).map(({ label, url }) => ({ label: label || "", url }))));
    ["title", "description", "duration"].forEach((key) => { if (req.body[key] !== undefined) lesson[key] = req.body[key]; });
    Object.assign(lesson, lessonContent.values, topicContent.values);
    if (referenceContent.references) lesson.references = referenceContent.references;
    const previousQuizMedia = quizContent.values ? quizMediaNames(lesson.quiz) : [];
    if (quizContent.values) lesson.quiz = quizContent.values.quiz;
    if ((contentChanged || quizContent.values) && course.moderationStatus !== "rejected") course.moderationStatus = "unpublished";
    await course.save();
    // Attachments that are no longer part of the quiz are removed from disk.
    const keptQuizMedia = new Set(quizMediaNames(lesson.quiz));
    deleteQuizMediaFiles(previousQuizMedia.filter((storedName) => !keptQuizMedia.has(storedName)));
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
    const durationSeconds = Number(req.body.durationSeconds);
    if (req.body.durationSeconds !== undefined && (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > 86400)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "A valid video duration is required" });
    }
    lesson.primaryMedia = mediaDescriptor(req.file);
    lesson.duration = req.body.durationSeconds === undefined ? "Provider managed" : `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`;
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
    deleteQuizMediaFiles(quizMediaNames(lesson.quiz));
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
    const eventGroups = courseIds.length ? await ConfusionEvent.aggregate(topicEventPipeline(courseIds)) : [];
    const exposures = courseIds.length ? await LessonVideoExposure.find({ course: { $in: courseIds } }).select("student course lessonId watchedRanges").lean() : [];
    const topicInsights = topicAnalytics(courses, validSignals, eventGroups, exposures);
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
        return { lessonId: lesson._id, lessonOrder: index + 1, lessonTitle: lesson.title, predictionCount: items.length, predictedClear: items.length - confused, predictedConfused: confused, confusionRate: items.length ? Math.round((confused / items.length) * 100) : null, modelVersion: latestItem?.aiPrediction.modelVersion || null, latestPredictionAt: latest, ...topicInsights.get(`${course._id}:${lesson._id}`) };
      });
      const analyzedLessons = lessons.filter((lesson) => lesson.predictionCount > 0);
      const coursePredictions = analyzedLessons.reduce((sum, lesson) => sum + lesson.predictionCount, 0);
      const courseConfused = analyzedLessons.reduce((sum, lesson) => sum + lesson.predictedConfused, 0);
      const totalStudentsAnalyzed = new Set(validSignals.filter((signal) => String(signal.course) === String(course._id)).map((signal) => String(signal.student))).size;
      return { courseId: course._id, courseTitle: course.name, courseCover: course.thumbnail || "", category: course.category || "General Education", predictionLessonCount: analyzedLessons.length, totalStudentsAnalyzed, overallConfusionRate: coursePredictions >= 5 ? Math.round((courseConfused / coursePredictions) * 100) : null, lessons: lessons.filter(lesson => lesson.predictionCount > 0 || lesson.topics.length > 0) };
    });
    return res.json({ generatedAt: new Date().toISOString(), totalStudentsAnalyzed: new Set(validSignals.filter((signal) => signal.student).map((signal) => String(signal.student))).size, totalStudents: uniqueStudents, totalEnrollments, averageProgress: totalEnrollments ? Math.round(enrollments.reduce((sum, item) => sum + percent(item), 0) / totalEnrollments) : 0, completionRate: totalEnrollments ? Math.round((enrollments.filter((item) => percent(item) === 100).length / totalEnrollments) * 100) : 0, mostPopularCourse: [...rows].sort((a, b) => b.enrollments - a.enrollments)[0]?.name || "No enrollments yet", courses: rows, heatmapCourses });
  } catch (error) { return res.status(500).json({ message: "Unable to load analytics" }); }
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

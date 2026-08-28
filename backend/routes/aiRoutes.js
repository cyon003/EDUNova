const express = require("express");
const mongoose = require("mongoose");
const { rateLimit } = require("express-rate-limit");
const ChatbotConversation = require("../models/ChatbotConversation");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LessonResourceChunk = require("../models/LessonResourceChunk");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
const MODES = new Set(["course", "general"]);
const MAX_MESSAGE_LENGTH = 1000;
const MAX_ANSWER_LENGTH = 8000;
const FOLLOW_UP_PATTERN = /\b(this|that|it|more|simpl(?:e|er|ify)|example|continue|elaborate|rephrase|mean)\b/i;
const MAX_FOLLOW_UP_LENGTH = 180;
const GENERAL_DISCLAIMER = "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials.";
const GENERAL_UNAVAILABLE_MESSAGE = "The General AI Tutor is temporarily unavailable. Please try again later.";

router.use(authenticateToken);

function configuredLimit(name, fallback) {
  return Math.min(Math.max(Number.parseInt(process.env[name], 10) || fallback, 1), 100);
}

const courseLimiter = rateLimit({
  windowMs: 60_000,
  limit: () => configuredLimit("AI_COURSE_RATE_LIMIT_PER_MINUTE", Number(process.env.AI_CHATBOT_RATE_LIMIT_MAX || 20)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  handler: (_req, res) => res.status(429).json({ message: "Too many Course Assistant requests. Please wait before trying again." }),
});
const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: () => configuredLimit("AI_GENERAL_RATE_LIMIT_PER_MINUTE", 5),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  handler: (_req, res) => res.status(429).json({ message: "Too many General AI Tutor requests. Please wait before trying again." }),
});

function validObjectId(value) { return typeof value === "string" && mongoose.isObjectIdOrHexString(value); }
function validateMode(req, res, next) {
  if (!MODES.has(req.body?.mode)) return res.status(400).json({ message: "mode must be either course or general" });
  return next();
}
function modeRateLimit(req, res, next) { return (req.body.mode === "general" ? generalLimiter : courseLimiter)(req, res, next); }

async function canAccessCourse(user, course) {
  if (user.role === "admin") return true;
  if (user.role === "tutor") return String(course.tutor || "") === String(user._id);
  if (user.role !== "student" || course.moderationStatus !== "published") return false;
  return Boolean(await Enrollment.exists({ student: user._id, course: course._id }));
}

function boundDocuments(candidates) {
  const maxContent = Math.min(Math.max(Number(process.env.AI_CHATBOT_MAX_TOTAL_TEXT || 100000), 1000), 500000);
  const maxDocuments = Math.min(Math.max(Number(process.env.AI_CHATBOT_MAX_DOCUMENTS || 100), 1), 100);
  let total = 0;
  return candidates.reduce((documents, document) => {
    if (total >= maxContent || documents.length >= maxDocuments) return documents;
    const content = String(document.content || "").slice(0, maxContent - total); total += content.length;
    if (content.trim()) documents.push({ ...document, content });
    return documents;
  }, []);
}

async function buildDocuments(course, selectedLesson) {
  const maxDocuments = Math.min(Math.max(Number(process.env.AI_CHATBOT_MAX_DOCUMENTS || 100), 1), 100);
  const candidates = [{ id: String(course._id), title: `${course.name} overview`, content: course.description, type: "course" }];
  const lessons = selectedLesson ? [selectedLesson] : course.lessons;
  lessons.forEach((lesson) => {
    const content = [lesson.title, lesson.description].filter(Boolean).join(". ");
    if (content.trim()) candidates.push({ id: String(lesson._id), title: lesson.title, content, type: "lesson", lessonTitle: lesson.title });
  });
  const chunkFilter = { course: course._id };
  if (selectedLesson) chunkFilter.lesson = selectedLesson._id;
  const chunks = await LessonResourceChunk.find(chunkFilter).sort({ lesson: 1, resource: 1, chunkNumber: 1 }).limit(maxDocuments).lean();
  const lessonTitles = new Map(course.lessons.map((lesson) => [String(lesson._id), lesson.title]));
  chunks.forEach((chunk) => candidates.push(documentFromResourceChunk(chunk, lessonTitles)));
  return boundDocuments(candidates);
}

function extractExplicitTopic(message) {
  return message.toLowerCase().replace(/\bnext[.\s-]*js\b/g, "nextjs").replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\bgive\s+me\s+(?:an?|another)?\b/g, " ")
    .replace(/\b(?:explain|describe|elaborate|rephrase|summarize|tell|show|make|give|more|detail|detailed|about|please|simply|simpler|simple|beginner|friendly|example|examples|continue|mean|what|does|is|how|in|of|this|that|it|me|another)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
function isReferentialFollowUp(message) { return message.length <= MAX_FOLLOW_UP_LENGTH && FOLLOW_UP_PATTERN.test(message) && !extractExplicitTopic(message); }
function documentFromResourceChunk(chunk, lessonTitles) {
  return { id: String(chunk._id), title: chunk.originalFilename, content: chunk.content, type: "resource", filename: chunk.originalFilename, lessonTitle: lessonTitles.get(String(chunk.lesson)) || "Lesson resource", chunkNumber: chunk.chunkNumber, pageNumber: chunk.pageNumber };
}

async function resolveFollowUp({ user, course, selectedLesson, message, documents }) {
  if (!isReferentialFollowUp(message)) return { isFollowUp: false, documents };
  const historyFilter = { user: user._id, mode: "course", course: course._id, lesson: selectedLesson?._id || null, fallback: false, answerMode: { $in: ["generated", "extractive"] }, "source.id": { $ne: "" } };
  const previous = await ChatbotConversation.findOne(historyFilter).select("+retrievalTopic").sort({ createdAt: -1 }).lean();
  if (!previous) return { isFollowUp: true, resolved: false, documents };
  const authorizedById = new Map(documents.map((document) => [document.id, document]));
  let verifiedSource = authorizedById.get(previous.source.id); let expandedDocuments = documents;
  if (previous.source.type === "resource") {
    const sourceFilter = { _id: previous.source.id, course: course._id };
    if (selectedLesson) sourceFilter.lesson = selectedLesson._id;
    const sourceChunk = await LessonResourceChunk.findOne(sourceFilter).lean();
    if (!sourceChunk) return { isFollowUp: true, resolved: false, documents };
    const adjacent = await LessonResourceChunk.find({ course: course._id, lesson: sourceChunk.lesson, resource: sourceChunk.resource, chunkNumber: { $in: [sourceChunk.chunkNumber - 1, sourceChunk.chunkNumber, sourceChunk.chunkNumber + 1].filter((value) => value > 0) } }).sort({ chunkNumber: 1 }).lean();
    const lessonTitles = new Map(course.lessons.map((lesson) => [String(lesson._id), lesson.title]));
    const additions = adjacent.map((chunk) => documentFromResourceChunk(chunk, lessonTitles));
    expandedDocuments = boundDocuments([...additions, ...documents.filter((document) => !additions.some((item) => item.id === document.id))]);
    verifiedSource = additions.find((document) => document.id === previous.source.id);
  }
  if (!verifiedSource) return { isFollowUp: true, resolved: false, documents };
  return { isFollowUp: true, resolved: true, resolvedTopic: previous.retrievalTopic || previous.userMessage, retrievalQuery: `${previous.retrievalTopic || previous.userMessage} ${message}`, preferredSourceId: verifiedSource.id, documents: expandedDocuments };
}

function publicCourse(course) { return { _id: course._id, name: course.name, moderationStatus: course.moderationStatus, lessons: course.lessons.map((lesson) => ({ _id: lesson._id, title: lesson.title })) }; }
function contextMessages(records) {
  return records.reverse().flatMap((item) => [{ role: "user", content: item.userMessage.slice(0, 1000) }, { role: "assistant", content: item.assistantAnswer.slice(0, 1000) }]);
}
async function callFlask(payload) {
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(Number(process.env.PYTHON_CHATBOT_TIMEOUT_MS || 70000), 1000), 120000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${String(process.env.PYTHON_CHATBOT_URL || "http://127.0.0.1:5001").replace(/\/$/, "")}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw Object.assign(new Error("invalid_response"), { status: 502, category: "gemini_invalid_response", publicMessage: "The AI Assistant returned an invalid response. Please try again." }); }
    if (!response.ok) throw Object.assign(new Error("provider_failure"), { status: response.status, category: data.category || "unknown_provider_error", publicMessage: data.message || "The AI Assistant is temporarily unavailable. Please try again." });
    return data;
  } catch (error) {
    if (error.publicMessage) throw error;
    const timedOut = error.name === "AbortError";
    throw Object.assign(error, { status: timedOut ? 504 : 503, category: timedOut ? "gemini_timeout" : "flask_unavailable", publicMessage: timedOut ? "General AI took too long to respond. Please try again." : "The AI Assistant is temporarily unavailable. Please try again." });
  } finally { clearTimeout(timeout); }
}

router.get("/courses", async (req, res) => {
  try {
    let courses;
    if (req.user.role === "student") {
      const enrollments = await Enrollment.find({ student: req.user._id }).select("course");
      courses = await Course.find({ _id: { $in: enrollments.map((item) => item.course) }, moderationStatus: "published" }).sort({ name: 1 });
    } else if (req.user.role === "tutor") courses = await Course.find({ tutor: req.user._id }).sort({ name: 1 });
    else if (req.user.role === "admin") courses = await Course.find({}).sort({ name: 1 });
    else return res.status(403).json({ message: "You do not have permission" });
    return res.json(courses.map(publicCourse));
  } catch (error) { console.error("Get assistant courses error:", error); return res.status(500).json({ message: "Unable to load assistant courses" }); }
});

async function historyScope(req, res) {
  const mode = req.query.mode;
  if (!MODES.has(mode)) { res.status(400).json({ message: "mode must be either course or general" }); return null; }
  const filter = { user: req.user._id, mode };
  if (mode === "general") {
    if (req.query.courseId || req.query.lessonId) { res.status(400).json({ message: "General mode does not accept courseId or lessonId" }); return null; }
    filter.course = null; filter.lesson = null;
    return filter;
  }
  if (!validObjectId(req.query.courseId)) { res.status(400).json({ message: "A valid courseId is required for course history" }); return null; }
  const course = await Course.findById(req.query.courseId);
  if (!course) { res.status(404).json({ message: "Course not found" }); return null; }
  if (!(await canAccessCourse(req.user, course))) { res.status(403).json({ message: "You do not have access to this course's learning materials" }); return null; }
  filter.course = req.query.courseId;
  if (req.query.lessonId) {
    if (!validObjectId(req.query.lessonId)) { res.status(400).json({ message: "lessonId must be valid" }); return null; }
    if (!course.lessons.id(req.query.lessonId)) { res.status(404).json({ message: "Lesson not found in this course" }); return null; }
    filter.lesson = req.query.lessonId;
  } else filter.lesson = null;
  return filter;
}

router.get("/history", async (req, res) => {
  try {
    const filter = await historyScope(req, res); if (!filter) return undefined;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1); const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    const [items, total] = await Promise.all([ChatbotConversation.find(filter).populate("course", "name slug").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), ChatbotConversation.countDocuments(filter)]);
    return res.json({ mode: filter.mode, items, ...(filter.mode === "general" ? { disclaimer: GENERAL_DISCLAIMER } : {}), page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) { console.error("Get assistant history error:", error); return res.status(500).json({ message: "Unable to load assistant history" }); }
});

router.delete("/history", async (req, res) => {
  try {
    const filter = await historyScope(req, res); if (!filter) return undefined;
    const result = await ChatbotConversation.deleteMany(filter);
    return res.json({ message: `${filter.mode === "course" ? "Course Assistant" : "General AI Tutor"} history cleared`, mode: filter.mode, deletedCount: result.deletedCount });
  } catch (error) { console.error("Clear assistant history error:", error); return res.status(500).json({ message: "Unable to clear assistant history" }); }
});

async function handleGeneral(req, res, message) {
  if (req.body.courseId !== undefined || req.body.lessonId !== undefined || req.body.sources !== undefined || req.body.documents !== undefined) return res.status(400).json({ message: "General mode does not accept courseId, lessonId, documents, or sources" });
  const contextLimit = Math.min(Math.max(Number(process.env.AI_CHATBOT_RECENT_CONTEXT_LIMIT || 3), 0), 5);
  const records = contextLimit ? await ChatbotConversation.find({ user: req.user._id, mode: "general", course: null, lesson: null, answerMode: "generated" }).select("userMessage assistantAnswer").sort({ createdAt: -1 }).limit(contextLimit).lean() : [];
  const result = await callFlask({ mode: "general", message, conversation: contextMessages(records) });
  if (result.mode !== "general" || result.grounded !== false || !["generated", "unavailable"].includes(result.responseType) || typeof result.answer !== "string" || !result.answer.trim() || !Array.isArray(result.sources) || result.sources.length || result.disclaimer !== GENERAL_DISCLAIMER) return res.status(503).json({ message: GENERAL_UNAVAILABLE_MESSAGE });
  if (result.answer.trim().length > MAX_ANSWER_LENGTH) return res.status(503).json({ message: GENERAL_UNAVAILABLE_MESSAGE });
  const answer = result.responseType === "generated" ? result.answer.trim() : GENERAL_UNAVAILABLE_MESSAGE;
  const saved = await ChatbotConversation.create({ user: req.user._id, mode: "general", course: null, lesson: null, userMessage: message, assistantAnswer: answer, confidence: 0, source: undefined, sources: [], fallback: result.responseType !== "generated", answerMode: result.responseType });
  return res.status(200).json({ mode: "general", answer: saved.assistantAnswer, responseType: saved.answerMode, grounded: false, sources: [], disclaimer: GENERAL_DISCLAIMER, conversationId: saved._id, createdAt: saved.createdAt });
}

async function handleCourse(req, res, message) {
  const { courseId, lessonId } = req.body;
  if (!validObjectId(courseId)) return res.status(400).json({ message: "A valid courseId is required" });
  if (lessonId !== undefined && lessonId !== null && lessonId !== "" && !validObjectId(lessonId)) return res.status(400).json({ message: "lessonId must be a valid identifier" });
  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!(await canAccessCourse(req.user, course))) return res.status(403).json({ message: "You do not have access to this course's learning materials" });
  const selectedLesson = lessonId ? course.lessons.id(lessonId) : null;
  if (lessonId && !selectedLesson) return res.status(404).json({ message: "Lesson not found in this course" });
  let documents = await buildDocuments(course, selectedLesson);
  const followUp = await resolveFollowUp({ user: req.user, course, selectedLesson, message, documents }); documents = followUp.documents;
  const contextLimit = Math.min(Math.max(Number(process.env.AI_CHATBOT_RECENT_CONTEXT_LIMIT || 3), 0), 5);
  const records = contextLimit ? await ChatbotConversation.find({ user: req.user._id, mode: "course", course: course._id, lesson: selectedLesson?._id || null }).select("userMessage assistantAnswer").sort({ createdAt: -1 }).limit(contextLimit).lean() : [];
  const result = await callFlask({ mode: "course", message, documents, conversation: contextMessages(records), followUp: { isFollowUp: followUp.isFollowUp, resolved: Boolean(followUp.resolved), resolvedTopic: followUp.resolvedTopic || "", retrievalQuery: followUp.retrievalQuery || "", preferredSourceId: followUp.preferredSourceId || "" } });
  if (result.mode !== "course" || result.grounded !== true || !["generated", "extractive", "fallback"].includes(result.responseType) || typeof result.answer !== "string" || !result.answer.trim() || !Number.isFinite(result.confidence) || !Array.isArray(result.sources)) return res.status(503).json({ message: "The Course Assistant returned an invalid response. Please try again." });
  const sourceDocument = result.source?.id ? documents.find((document) => document.id === String(result.source.id)) : null;
  if (result.responseType !== "fallback" && !sourceDocument) return res.status(503).json({ message: "The Course Assistant returned an invalid source. Please try again." });
  const trustedSource = sourceDocument ? { id: sourceDocument.id, title: sourceDocument.title, type: sourceDocument.type, filename: sourceDocument.filename || "", lessonTitle: sourceDocument.lessonTitle || "", chunkNumber: sourceDocument.chunkNumber || null, pageNumber: sourceDocument.pageNumber || null } : null;
  const trustedSources = [];
  for (const returnedSource of result.sources.slice(0, 5)) {
    const authorized = returnedSource?.id ? documents.find((document) => document.id === String(returnedSource.id)) : null;
    if (!authorized) return res.status(503).json({ message: "The Course Assistant returned an invalid source. Please try again." });
    if (trustedSources.some((source) => source.id === authorized.id)) continue;
    trustedSources.push({ id: authorized.id, title: authorized.title, type: authorized.type, filename: authorized.filename || "", lessonTitle: authorized.lessonTitle || "", chunkNumber: authorized.chunkNumber || null, pageNumber: authorized.pageNumber || null, confidence: Number.isFinite(returnedSource.confidence) ? Math.min(Math.max(returnedSource.confidence, 0), 1) : null });
  }
  if (trustedSource && !trustedSources.some((source) => source.id === trustedSource.id)) trustedSources.unshift({ ...trustedSource, confidence: Math.min(Math.max(result.confidence, 0), 1) });
  if (result.answer.trim().length > MAX_ANSWER_LENGTH) return res.status(503).json({ message: "The Course Assistant returned an invalid response. Please try again." });
  const saved = await ChatbotConversation.create({ user: req.user._id, mode: "course", course: course._id, lesson: selectedLesson?._id || null, userMessage: message, retrievalTopic: followUp.resolvedTopic || message, assistantAnswer: result.answer.trim(), confidence: Math.min(Math.max(result.confidence, 0), 1), source: trustedSource || undefined, sources: trustedSources, fallback: result.responseType === "fallback", answerMode: result.responseType });
  return res.status(200).json({ mode: "course", answer: saved.assistantAnswer, responseType: saved.answerMode, grounded: true, confidence: saved.confidence, source: saved.source?.id ? saved.source : null, sources: saved.sources || [], conversationId: saved._id, createdAt: saved.createdAt });
}

router.post("/chat", validateMode, modeRateLimit, async (req, res) => {
  try {
    const { message, mode } = req.body || {};
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ message: "Message is required" });
    const cleaned = message.trim();
    if (cleaned.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    return mode === "general" ? await handleGeneral(req, res, cleaned) : await handleCourse(req, res, cleaned);
  } catch (error) {
    if (error.publicMessage) return res.status(error.status || 503).json({ message: error.publicMessage, category: error.category || "unknown_provider_error" });
    console.error("AI Assistant error:", error); return res.status(500).json({ message: "Unable to process the assistant request" });
  }
});

module.exports = router;

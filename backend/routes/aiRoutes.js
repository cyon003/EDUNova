const express = require("express");
const { rateLimit } = require("express-rate-limit");
const ChatbotConversation = require("../models/ChatbotConversation");
const authenticateToken = require("../middleware/authMiddleware");

const geminiService = require("../services/geminiService");
const subscriptionService = require("../services/subscriptionService");

const { resolveLessonContext, validateLessonInput } = require("../services/lessonAiContextService");
const LESSON_DISCLAIMER = "AI-generated using available lesson context; verify important details with your tutor.";

const router = express.Router();
const MAX_MESSAGE_LENGTH = 1000;
const MAX_ANSWER_LENGTH = 8000;
const GENERAL_DISCLAIMER = "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials.";
const GENERAL_UNAVAILABLE_MESSAGE = "The General AI Tutor is temporarily unavailable. Please try again later.";
const COURSE_FIELDS = ["courseId", "lessonId", "documents", "sources", "followUp", "videoTimestampSeconds", "topicId", "topicTitle", "transcript", "studentId", "confusionProbability", "features"];

router.use(authenticateToken);

function configuredLimit(name, fallback) {
  return Math.min(Math.max(Number.parseInt(process.env[name], 10) || fallback, 1), 100);
}

const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: () => configuredLimit("AI_GENERAL_RATE_LIMIT_PER_MINUTE", 5),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  handler: (_req, res) => res.status(429).json({ message: "Too many General AI Tutor requests. Please wait before trying again." }),
});

function hasCourseFields(container = {}) {
  return COURSE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(container, field));
}

function validateChatRequest(req, res, next) {
  if (req.body?.mode === "lesson") {
    try { validateLessonInput(req.body); return next(); }
    catch (error) { return res.status(error.status || 400).json({ message: error.publicMessage || "Invalid lesson context" }); }
  }
  if (req.body?.mode !== "general") return res.status(400).json({ message: "mode must be general" });
  if (hasCourseFields(req.body)) return res.status(400).json({ message: "General AI Tutor does not accept courseId, lessonId, documents, sources, or followUp" });
  return next();
}

async function historyScope(req, res) {
  if (req.query.mode === "lesson") return resolveLessonContext(req.user, req.query, { history: true });
  if (req.query.mode !== "general") {
    res.status(400).json({ message: "mode must be general" });
    return null;
  }
  if (hasCourseFields(req.query)) {
    res.status(400).json({ message: "General AI Tutor history does not accept courseId, lessonId, documents, sources, or followUp" });
    return null;
  }
  return { scope: { user: req.user._id, mode: "general" } };
}

function contextMessages(records) {
  return records.reverse().flatMap((item) => [
    { role: "user", content: item.userMessage.slice(0, 1000) },
    { role: "assistant", content: item.assistantAnswer.slice(0, 1000) },
  ]);
}

router.get("/history", async (req, res) => {
  try {
    const context = await historyScope(req, res);
    if (!context) return undefined;
    const filter = context.scope;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    const [items, total] = await Promise.all([
      ChatbotConversation.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      ChatbotConversation.countDocuments(filter),
    ]);
    return res.json({ mode: filter.mode, items, ...(context.metadata ? { context: context.metadata } : {}), disclaimer: filter.mode === "lesson" ? LESSON_DISCLAIMER : GENERAL_DISCLAIMER, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Get AI Tutor history error:", error.status || "internal_error");
    return res.status(error.status || 500).json({ message: error.publicMessage || "Unable to load AI Tutor history" });
  }
});

router.delete("/history", async (req, res) => {
  try {
    const context = await historyScope(req, res);
    if (!context) return undefined;
    const filter = context.scope;
    const result = await ChatbotConversation.deleteMany(filter);
    return res.json({ message: "AI Tutor history cleared", mode: filter.mode, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Clear AI Tutor history error:", error.status || "internal_error");
    return res.status(error.status || 500).json({ message: error.publicMessage || "Unable to clear AI Tutor history" });
  }
});

router.post("/chat", validateChatRequest, generalLimiter, async (req, res) => {
  let reservation;
  try {
    const { message } = req.body;
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ message: "Message is required" });
    const cleaned = message.trim();
    if (cleaned.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });

    const mode = req.body.mode;
    const lessonContext = mode === "lesson" ? await resolveLessonContext(req.user, req.body) : null;
    const scope = lessonContext?.scope || { user: req.user._id, mode: "general" };
    const disclaimer = mode === "lesson" ? LESSON_DISCLAIMER : GENERAL_DISCLAIMER;
    reservation = await subscriptionService.reserveUsage(req.user);
    const contextLimit = Math.min(Math.max(Number(process.env.AI_CHATBOT_RECENT_CONTEXT_LIMIT || 3), 0), 5);
    const records = contextLimit
      ? await ChatbotConversation.find({ ...scope, answerMode: "generated" })
        .select("userMessage assistantAnswer").sort({ createdAt: -1 }).limit(contextLimit).lean()
      : [];
    const result = await geminiService.generateAnswer({ mode, message: cleaned, conversation: contextMessages(records), ...(lessonContext ? { lessonContext: lessonContext.material } : {}) });
    if (result.mode !== mode || result.responseType !== "generated" || typeof result.answer !== "string" || !result.answer.trim() || result.disclaimer !== disclaimer) {
      return res.status(503).json({ message: GENERAL_UNAVAILABLE_MESSAGE });
    }
    if (result.answer.trim().length > MAX_ANSWER_LENGTH) return res.status(503).json({ message: GENERAL_UNAVAILABLE_MESSAGE });

    const saved = await ChatbotConversation.create({ user: req.user._id, mode, ...(lessonContext?.record || {}), userMessage: cleaned, assistantAnswer: result.answer.trim(), answerMode: "generated" });
    await subscriptionService.settleUsage(reservation, true);
    reservation = null;
    let subscription;
    try { subscription = await subscriptionService.getSubscription(req.user); }
    catch (error) { console.error("Unable to refresh AI usage display:", error.message); }
    return res.status(200).json({ subscription, mode, ...(lessonContext ? { context: lessonContext.metadata } : {}), answer: saved.assistantAnswer, responseType: saved.answerMode, disclaimer, conversationId: saved._id, createdAt: saved.createdAt });
  } catch (error) {
    if (error.quota) return res.status(429).json(error.quota);
    console.error("AI Tutor error:", error.category || (error.publicMessage ? "request_rejected" : "internal_error"));
    return res.status(error.status || 500).json({ message: error.publicMessage || GENERAL_UNAVAILABLE_MESSAGE });
  } finally {
    if (reservation) {
      try { await subscriptionService.settleUsage(reservation, false); }
      catch (error) { console.error("Unable to release AI reservation:", error.message); }
    }
  }
});

module.exports = router;

const express = require("express");
const { rateLimit } = require("express-rate-limit");
const ChatbotConversation = require("../models/ChatbotConversation");
const authenticateToken = require("../middleware/authMiddleware");

const geminiService = require("../services/geminiService");
const subscriptionService = require("../services/subscriptionService");

const router = express.Router();
const MAX_MESSAGE_LENGTH = 1000;
const MAX_ANSWER_LENGTH = 8000;
const GENERAL_DISCLAIMER = "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials.";
const GENERAL_UNAVAILABLE_MESSAGE = "The General AI Tutor is temporarily unavailable. Please try again later.";
const COURSE_FIELDS = ["courseId", "lessonId", "documents", "sources", "followUp"];

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

function validateGeneralRequest(req, res, next) {
  if (req.body?.mode !== "general") return res.status(400).json({ message: "mode must be general" });
  if (hasCourseFields(req.body)) return res.status(400).json({ message: "General AI Tutor does not accept courseId, lessonId, documents, sources, or followUp" });
  return next();
}

function historyScope(req, res) {
  if (req.query.mode !== "general") {
    res.status(400).json({ message: "mode must be general" });
    return null;
  }
  if (hasCourseFields(req.query)) {
    res.status(400).json({ message: "General AI Tutor history does not accept courseId, lessonId, documents, sources, or followUp" });
    return null;
  }
  return { user: req.user._id, mode: "general" };
}

function contextMessages(records) {
  return records.reverse().flatMap((item) => [
    { role: "user", content: item.userMessage.slice(0, 1000) },
    { role: "assistant", content: item.assistantAnswer.slice(0, 1000) },
  ]);
}

router.get("/history", async (req, res) => {
  try {
    const filter = historyScope(req, res);
    if (!filter) return undefined;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    const [items, total] = await Promise.all([
      ChatbotConversation.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      ChatbotConversation.countDocuments(filter),
    ]);
    return res.json({ mode: "general", items, disclaimer: GENERAL_DISCLAIMER, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Get General AI Tutor history error:", error);
    return res.status(500).json({ message: "Unable to load General AI Tutor history" });
  }
});

router.delete("/history", async (req, res) => {
  try {
    const filter = historyScope(req, res);
    if (!filter) return undefined;
    const result = await ChatbotConversation.deleteMany(filter);
    return res.json({ message: "General AI Tutor history cleared", mode: "general", deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Clear General AI Tutor history error:", error);
    return res.status(500).json({ message: "Unable to clear General AI Tutor history" });
  }
});

router.post("/chat", validateGeneralRequest, generalLimiter, async (req, res) => {
  let reservation;
  try {
    const { message } = req.body;
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ message: "Message is required" });
    const cleaned = message.trim();
    if (cleaned.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });

    reservation = await subscriptionService.reserveUsage(req.user);
    const contextLimit = Math.min(Math.max(Number(process.env.AI_CHATBOT_RECENT_CONTEXT_LIMIT || 3), 0), 5);
    const records = contextLimit
      ? await ChatbotConversation.find({ user: req.user._id, mode: "general", answerMode: "generated" })
        .select("userMessage assistantAnswer").sort({ createdAt: -1 }).limit(contextLimit).lean()
      : [];
    const result = await geminiService.generateAnswer({ mode: "general", message: cleaned, conversation: contextMessages(records) });
    if (result.mode !== "general" || result.responseType !== "generated" || typeof result.answer !== "string" || !result.answer.trim() || result.disclaimer !== GENERAL_DISCLAIMER) {
      return res.status(503).json({ message: GENERAL_UNAVAILABLE_MESSAGE });
    }
    if (result.answer.trim().length > MAX_ANSWER_LENGTH) return res.status(503).json({ message: GENERAL_UNAVAILABLE_MESSAGE });

    const saved = await ChatbotConversation.create({ user: req.user._id, mode: "general", userMessage: cleaned, assistantAnswer: result.answer.trim(), answerMode: "generated" });
    await subscriptionService.settleUsage(reservation, true);
    reservation = null;
    let subscription;
    try { subscription = await subscriptionService.getSubscription(req.user); }
    catch (error) { console.error("Unable to refresh AI usage display:", error.message); }
    return res.status(200).json({ subscription, mode: "general", answer: saved.assistantAnswer, responseType: saved.answerMode, disclaimer: GENERAL_DISCLAIMER, conversationId: saved._id, createdAt: saved.createdAt });
  } catch (error) {
    if (error.quota) return res.status(429).json(error.quota);
    console.error("General AI Tutor error:", error.category || error.message);
    return res.status(error.status || 500).json({ message: error.publicMessage || GENERAL_UNAVAILABLE_MESSAGE });
  } finally {
    if (reservation) {
      try { await subscriptionService.settleUsage(reservation, false); }
      catch (error) { console.error("Unable to release AI reservation:", error.message); }
    }
  }
});

module.exports = router;

const express = require("express");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { requestPrediction } = require("../services/confusionPredictionService");

const router = express.Router();
const interactionFields = new Set(["maximumVideoProgressPercent", "activeTimeSecondsDelta", "pauseCountDelta", "replayCountDelta", "visitCountDelta"]);
const feedbackFields = new Set(["feedback"]);
const caps = { activeTimeSecondsDelta: 300, pauseCountDelta: 100, replayCountDelta: 100, visitCountDelta: 1 };
const predictionFeatures = ["maximumVideoProgressPercent", "activeTimeSeconds", "pauseCount", "replayCount", "visitCount", "lessonCompleted"];

router.use(authenticateToken);
router.use(requireRole("student"));

function defaultSignal(courseId, lessonId, lessonCompleted) {
  return { course: courseId, lessonId, maximumVideoProgressPercent: 0, activeTimeSeconds: 0, pauseCount: 0, replayCount: 0, visitCount: 0, lessonCompleted, confusionFeedback: null, feedbackUpdatedAt: null, lastInteractionAt: null };
}

function hasOnly(body, allowed) {
  return body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).every((key) => allowed.has(key));
}

async function authorizedSignalTarget(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.courseId) || !mongoose.isObjectIdOrHexString(req.params.lessonId)) {
    res.status(400).json({ message: "A valid course and lesson are required" }); return null;
  }
  const course = await Course.findById(req.params.courseId);
  if (!course) { res.status(404).json({ message: "Course not found" }); return null; }
  const lesson = course.lessons.id(req.params.lessonId);
  if (!lesson) { res.status(404).json({ message: "Lesson does not belong to this course" }); return null; }
  const enrollment = await Enrollment.findOne({ student: req.user._id, course: course._id });
  if (!enrollment) { res.status(403).json({ message: "Enroll in this course before recording learning activity" }); return null; }
  const lessonIndex = course.lessons.findIndex((item) => String(item._id) === String(lesson._id));
  return { course, lesson, lessonIndex, enrollment };
}

function validateInteractions(body) {
  if (!hasOnly(body, interactionFields) || !Object.keys(body).length) return "Only supported learning-signal fields are allowed";
  if (Object.hasOwn(body, "maximumVideoProgressPercent")) {
    if (typeof body.maximumVideoProgressPercent !== "number" || !Number.isFinite(body.maximumVideoProgressPercent) || body.maximumVideoProgressPercent < 0 || body.maximumVideoProgressPercent > 100) return "Video progress must be a finite number from 0 to 100";
  }
  for (const [field, cap] of Object.entries(caps)) {
    if (!Object.hasOwn(body, field)) continue;
    if (!Number.isInteger(body[field]) || body[field] < 0) return `${field} must be a non-negative integer`;
    if (body[field] > cap) return `${field} exceeds the maximum update size of ${cap}`;
  }
  return null;
}

function signalUpdate(body, now, lessonCompleted) {
  const update = { $set: { lastInteractionAt: now }, $setOnInsert: { confusionFeedback: null, feedbackUpdatedAt: null, lessonCompleted } };
  if (Object.hasOwn(body, "maximumVideoProgressPercent")) update.$max = { maximumVideoProgressPercent: body.maximumVideoProgressPercent };
  const increments = {};
  for (const field of Object.keys(caps)) if (body[field]) increments[field.replace("Delta", "")] = body[field];
  if (Object.keys(increments).length) update.$inc = increments;
  return update;
}

async function safeUpsert(filter, update) {
  try {
    return await LearningSignal.findOneAndUpdate(filter, update, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return LearningSignal.findOneAndUpdate(filter, update, { new: true, runValidators: true });
  }
}

router.get("/:courseId/:lessonId", async (req, res) => {
  try {
    const target = await authorizedSignalTarget(req, res); if (!target) return;
    const signal = await LearningSignal.findOne({ student: req.user._id, course: target.course._id, lessonId: target.lesson._id });
    const completed = target.enrollment.completedLessons?.includes(target.lessonIndex) || false;
    return res.json(signal || defaultSignal(target.course._id, target.lesson._id, completed));
  } catch (error) { console.error("Get learning signal error:", error); return res.status(500).json({ message: "Unable to load learning activity" }); }
});

router.patch("/:courseId/:lessonId", async (req, res) => {
  try {
    const validationError = validateInteractions(req.body);
    if (validationError) return res.status(400).json({ message: validationError });
    const target = await authorizedSignalTarget(req, res); if (!target) return;
    const filter = { student: req.user._id, course: target.course._id, lessonId: target.lesson._id };
    const completed = target.enrollment.completedLessons?.includes(target.lessonIndex) || false;
    const signal = await safeUpsert(filter, signalUpdate(req.body, new Date(), completed));
    return res.json(signal);
  } catch (error) { console.error("Update learning signal error:", error); return res.status(500).json({ message: "Unable to save learning activity" }); }
});

router.patch("/:courseId/:lessonId/feedback", async (req, res) => {
  try {
    if (!hasOnly(req.body, feedbackFields) || !["clear", "confused"].includes(req.body.feedback)) return res.status(400).json({ message: "Feedback must be clear or confused" });
    const target = await authorizedSignalTarget(req, res); if (!target) return;
    const now = new Date();
    const signal = await safeUpsert(
      { student: req.user._id, course: target.course._id, lessonId: target.lesson._id },
      { $set: { confusionFeedback: req.body.feedback, feedbackUpdatedAt: now, lastInteractionAt: now }, $setOnInsert: { lessonCompleted: target.enrollment.completedLessons?.includes(target.lessonIndex) || false } }
    );
    return res.json(signal);
  } catch (error) { console.error("Update learning feedback error:", error); return res.status(500).json({ message: "Unable to save lesson feedback" }); }
});

router.post("/:courseId/:lessonId/prediction", async (req, res) => {
  try {
    if (req.body && Object.keys(req.body).length) return res.status(400).json({ message: "Prediction input is derived from the authenticated learning signal" });
    const target = await authorizedSignalTarget(req, res); if (!target) return;
    const filter = { student: req.user._id, course: target.course._id, lessonId: target.lesson._id };
    const existing = await LearningSignal.findOne(filter);
    const signal = existing || defaultSignal(target.course._id, target.lesson._id, target.enrollment.completedLessons?.includes(target.lessonIndex) || false);
    const features = Object.fromEntries(predictionFeatures.map((field) => [field, signal[field]]));
    const prediction = await requestPrediction(features);
    if (!prediction || !["clear", "confused"].includes(prediction.prediction) || !Number.isFinite(Number(prediction.confusionProbability)) || !Number.isFinite(Number(prediction.clearProbability)) || typeof prediction.modelVersion !== "string" || !prediction.modelVersion) {
      return res.status(502).json({ message: "Prediction service returned an invalid response" });
    }
    const aiPrediction = {
      prediction: prediction.prediction,
      confusionProbability: Number(prediction.confusionProbability),
      clearProbability: Number(prediction.clearProbability),
      modelVersion: prediction.modelVersion,
      predictedAt: prediction.predictedAt ? new Date(prediction.predictedAt) : new Date(),
    };
    const saved = await safeUpsert(filter, { $set: { aiPrediction }, $setOnInsert: { confusionFeedback: null, feedbackUpdatedAt: null, lessonCompleted: signal.lessonCompleted } });
    return res.json({ prediction: aiPrediction.prediction, confusionProbability: aiPrediction.confusionProbability, clearProbability: aiPrediction.clearProbability, modelVersion: aiPrediction.modelVersion, predictedAt: aiPrediction.predictedAt, confusionFeedback: saved.confusionFeedback ?? null });
  } catch (error) {
    console.error("Learning confusion prediction error:", error);
    return res.status(error.status || 503).json({ message: "Confusion prediction service is unavailable" });
  }
});

module.exports = router;

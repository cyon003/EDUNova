const mongoose = require("mongoose");
const LearningSignal = require("../models/LearningSignal");
const ConfusionEvent = require("../models/ConfusionEvent");
const { topicAtTimestamp } = require("../utils/lessonTopics");
const EVENT_COOLDOWN_MS = 120000;

async function recordConfusionEvent({ student, course, lesson, timestamp, prediction, features }, now = new Date()) {
  if (prediction.prediction !== "confused" || !Number.isFinite(timestamp) || timestamp < 0) return null;
  const topic = topicAtTimestamp(lesson, timestamp);
  const target = { student, course, lessonId: lesson._id };
  const deduplicationKey = topic ? `topic:${topic._id}` : `timestamp:${Math.floor(timestamp / 30)}`;
  return mongoose.connection.transaction(async (session) => {
    // Serialize competing event writes on the existing student/lesson document.
    // Only its internal revision changes; cumulative signals/prediction are retained.
    const lock = await LearningSignal.updateOne(target, { $inc: { __v: 1 } }, { session, timestamps: false });
    if (!lock.matchedCount) throw new Error("Learning signal no longer exists");
    const previous = await ConfusionEvent.findOne({ ...target, deduplicationKey, createdAt: { $gt: new Date(now.getTime() - EVENT_COOLDOWN_MS) } }).session(session);
    if (previous) return null;
    const [event] = await ConfusionEvent.create([{
      ...target, topicId: topic?._id || null, topicTitle: topic?.title || null,
      videoTimestampSeconds: timestamp, confusionProbability: prediction.confusionProbability,
      prediction: prediction.prediction, modelVersion: prediction.modelVersion,
      signalsSnapshot: features, source: "random_forest", deduplicationKey, createdAt: now,
    }], { session });
    return event;
  });
}
module.exports = { recordConfusionEvent, EVENT_COOLDOWN_MS };

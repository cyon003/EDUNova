const mongoose = require("mongoose");
const finiteNumber = (min, max) => ({ type: Number, required: true, min, ...(max === undefined ? {} : { max }), validate: Number.isFinite });
const counter = () => ({ ...finiteNumber(0), validate: Number.isSafeInteger });
const confusionEventSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, default: null },
  topicTitle: { type: String, default: null, trim: true, maxlength: 200 },
  videoTimestampSeconds: finiteNumber(0),
  confusionProbability: finiteNumber(0, 1),
  prediction: { type: String, enum: ["clear", "confused"], required: true },
  modelVersion: { type: String, required: true, trim: true },
  signalsSnapshot: {
    maximumVideoProgressPercent: finiteNumber(0, 100),
    activeTimeSeconds: counter(), pauseCount: counter(), replayCount: counter(), visitCount: counter(),
    lessonCompleted: { type: Boolean, required: true },
  },
  source: { type: String, enum: ["random_forest"], required: true },
  // Server-only grouping: topic ID or a 30-second bin for unmapped timestamps.
  deduplicationKey: { type: String, required: true, select: false },
}, { timestamps: { createdAt: true, updatedAt: false } });
confusionEventSchema.index({ course: 1, lessonId: 1, topicId: 1, createdAt: -1 });
confusionEventSchema.index({ student: 1, createdAt: -1 });
confusionEventSchema.index({ student: 1, course: 1, lessonId: 1, deduplicationKey: 1, createdAt: -1 });
module.exports = mongoose.model("ConfusionEvent", confusionEventSchema);

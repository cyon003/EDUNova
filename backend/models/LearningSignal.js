const mongoose = require("mongoose");

const learningSignalSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, required: true },
    maximumVideoProgressPercent: { type: Number, default: 0, min: 0, max: 100 },
    activeTimeSeconds: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: "Active time must be an integer" } },
    pauseCount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: "Pause count must be an integer" } },
    replayCount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: "Replay count must be an integer" } },
    visitCount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: "Visit count must be an integer" } },
    lessonCompleted: { type: Boolean, default: false },
    confusionFeedback: { type: String, enum: ["clear", "confused", null], default: null },
    feedbackUpdatedAt: { type: Date, default: null },
    lastInteractionAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

learningSignalSchema.index({ student: 1, course: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model("LearningSignal", learningSignalSchema);

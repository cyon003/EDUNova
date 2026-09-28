const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true },
  mediaVersion: { type: String, required: true },
  storage: String,
  storedName: String,
  status: { type: String, enum: ["queued", "processing", "completed", "failed", "superseded"], default: "queued" },
  attempts: { type: Number, default: 0 },
  availableAt: { type: Date, default: Date.now },
  leaseUntil: Date,
  leaseToken: String,
  errorCode: String,
  resultToken: String,
  segmentCount: Number,
  language: String,
  modelRevision: String,
  completedAt: Date,
}, { timestamps: true, collection: "transcription_jobs" });
schema.index({ course: 1, lessonId: 1, mediaVersion: 1 }, { unique: true });
schema.index({ status: 1, availableAt: 1, leaseUntil: 1 });
module.exports = mongoose.model("TranscriptionJob", schema);

const mongoose = require("mongoose");

const lessonWatchSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, required: true },
  mediaKey: { type: String, required: true },
  furthestWatchedPosition: { type: Number, default: 0, min: 0 },
  lastPosition: { type: Number, default: 0, min: 0 },
  videoDuration: { type: Number, default: 0, min: 0 },
  observedPlaybackSeconds: { type: Number, default: 0, min: 0 },
  isPlaying: { type: Boolean, default: false },
  playSegmentStartedAt: { type: Date, default: null },
  playSegmentStartPosition: { type: Number, default: 0, min: 0 },
  lastReportAt: { type: Date, default: null },
  revision: { type: Number, default: 0 },
  completionRecordedAt: { type: Date, default: null },
}, { timestamps: true });

lessonWatchSchema.index({ student: 1, course: 1, lesson: 1 }, { unique: true });

module.exports = mongoose.model("LessonWatch", lessonWatchSchema);

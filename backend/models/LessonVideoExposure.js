const mongoose = require("mongoose");
const { MAX_STORED_RANGES } = require("../utils/videoExposure");
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true },
  watchedRanges: { type: [{ _id: false, startTimeSeconds: { type: Number, required: true, min: 0 }, endTimeSeconds: { type: Number, required: true, min: 0 } }], default: [], validate: value => value.length <= MAX_STORED_RANGES },
  totalUniqueWatchedSeconds: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
schema.index({ student: 1, course: 1, lessonId: 1 }, { unique: true });
schema.index({ course: 1, lessonId: 1 });
module.exports = mongoose.model("LessonVideoExposure", schema);

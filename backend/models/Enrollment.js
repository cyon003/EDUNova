const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    completedLessons: { type: [Number], default: [] },
    completedMissions: { type: [String], default: [] },
    currentLessonIndex: { type: Number, default: 0, min: 0 },
    videoPositions: { type: Map, of: Number, default: {} },
    studySeconds: { type: Number, default: 0, min: 0 },
    studyDates: { type: [String], default: [] },
    recentActivity: {
      type: [{
        activityType: { type: String, enum: ["lesson_opened", "lesson_completed"], required: true },
        lessonIndex: { type: Number, required: true, min: 0 },
        lessonTitle: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", enrollmentSchema);

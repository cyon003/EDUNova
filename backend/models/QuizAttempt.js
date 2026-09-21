const mongoose = require("mongoose");

// One document per quiz submission. Attempts are never overwritten, so a
// student's full history (attempt 1, 2, 3 ...) is kept.
//
// The grade is computed on the server from the quiz stored on the Course; the
// score fields below are never taken from the request body.
const quizAttemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },

    // Lesson identity plus a snapshot of its position/title at submission time,
    // so history still reads correctly if the tutor later reorders lessons.
    lessonId: { type: mongoose.Schema.Types.ObjectId, required: true },
    lessonIndex: { type: Number, required: true, min: 0 },
    lessonTitle: { type: String, default: "", trim: true },

    // Quiz snapshot. The quiz _id changes whenever a tutor re-saves the quiz.
    quizId: { type: mongoose.Schema.Types.ObjectId },
    quizTitle: { type: String, default: "Lesson Quiz", trim: true },

    // Selected option index per question, in question order.
    answers: { type: [Number], default: [] },

    score: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 1 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    attemptNumber: { type: Number, required: true, min: 1 },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ student: 1, course: 1, lessonId: 1, submittedAt: -1 });

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);

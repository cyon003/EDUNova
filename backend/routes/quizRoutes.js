const express = require("express");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const QuizAttempt = require("../models/QuizAttempt");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { gradeQuiz } = require("../utils/quizAccess");
const { sendQuizMediaFile } = require("../utils/quizMedia");

const router = express.Router();

// Mounted at /api/quizzes. Only students take quizzes.
// The student is ALWAYS req.user._id (from the verified token). No student id is
// ever read from the URL, query string or body, so one student cannot read or
// create results for another.
router.use(authenticateToken, requireRole("student"));

// Loads the quiz for a lesson the signed-in student is allowed to take.
async function findQuizForStudent(req, res) {
  const course = await Course.findOne({ slug: String(req.params.slug || "").toLowerCase(), moderationStatus: "published" });
  if (!course) { res.status(404).json({ message: "Course not found" }); return null; }

  const lessonIndex = Number.parseInt(req.params.lessonIndex, 10);
  if (!Number.isInteger(lessonIndex) || lessonIndex < 0 || lessonIndex >= course.lessons.length) {
    res.status(404).json({ message: "Lesson not found" });
    return null;
  }

  const enrolled = await Enrollment.exists({ student: req.user._id, course: course._id });
  if (!enrolled) { res.status(403).json({ message: "Enroll in this course to take its quizzes" }); return null; }

  const lesson = course.lessons[lessonIndex];
  if (!lesson.quiz?.questions?.length) { res.status(404).json({ message: "This lesson has no quiz" }); return null; }

  return { course, lesson, lessonIndex };
}

// What the student is allowed to see about an attempt.
function attemptView(attempt) {
  return {
    _id: attempt._id,
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    correctCount: attempt.score,
    wrongCount: attempt.totalQuestions - attempt.score,
    submittedAt: attempt.submittedAt,
  };
}

function summarize(attempts) {
  const best = attempts.reduce((top, item) => (!top || item.percentage > top.percentage ? item : top), null);
  return { attemptCount: attempts.length, latest: attempts[0] || null, best };
}

// GET /api/quizzes/:slug/lessons/:lessonIndex/questions/:questionId/media
// The picture/audio attached to a question, for enrolled students only.
router.get("/:slug/lessons/:lessonIndex/questions/:questionId/media", async (req, res) => {
  try {
    const found = await findQuizForStudent(req, res);
    if (!found) return;
    const question = found.lesson.quiz.questions.find((item) => String(item._id) === req.params.questionId);
    const media = question?.media;
    if (!media?.storedName) return res.status(404).json({ message: "Attachment not found" });
    return sendQuizMediaFile(res, media.storedName, media.mimeType);
  } catch (error) {
    console.error("Load quiz media error:", error);
    return res.status(500).json({ message: "Unable to load the attachment" });
  }
});

// POST /api/quizzes/:slug/lessons/:lessonIndex/attempts   body: { answers: [0, 2, 1] }
router.post("/:slug/lessons/:lessonIndex/attempts", async (req, res) => {
  try {
    const found = await findQuizForStudent(req, res);
    if (!found) return;
    const { course, lesson, lessonIndex } = found;

    const graded = gradeQuiz(lesson.quiz, req.body?.answers);
    if (graded.error) return res.status(400).json({ message: graded.error });

    const previousAttempts = await QuizAttempt.countDocuments({ student: req.user._id, course: course._id, lessonId: lesson._id });
    const attempt = await QuizAttempt.create({
      student: req.user._id,
      course: course._id,
      lessonId: lesson._id,
      lessonIndex,
      lessonTitle: lesson.title,
      quizId: lesson.quiz._id,
      quizTitle: lesson.quiz.title,
      answers: req.body.answers,
      score: graded.score,
      totalQuestions: graded.totalQuestions,
      percentage: graded.percentage,
      attemptNumber: previousAttempts + 1,
    });

    // questionResults says which questions were right or wrong, not what the
    // right answer was, so retrying cannot be solved by reading the response.
    return res.status(201).json({ attempt: { ...attemptView(attempt), questionResults: graded.questionResults } });
  } catch (error) {
    console.error("Submit quiz error:", error);
    return res.status(500).json({ message: "Unable to submit the quiz" });
  }
});

// GET /api/quizzes/:slug/lessons/:lessonIndex/attempts  -> the signed-in student's own history
router.get("/:slug/lessons/:lessonIndex/attempts", async (req, res) => {
  try {
    const found = await findQuizForStudent(req, res);
    if (!found) return;
    const { course, lesson } = found;

    const attempts = (await QuizAttempt.find({ student: req.user._id, course: course._id, lessonId: lesson._id })
      .sort({ submittedAt: -1 })
      .limit(50)
      .lean()).map(attemptView);

    return res.status(200).json({ attempts, ...summarize(attempts) });
  } catch (error) {
    console.error("Load quiz attempts error:", error);
    return res.status(500).json({ message: "Unable to load quiz results" });
  }
});

module.exports = router;

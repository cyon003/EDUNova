// Helpers that keep the quiz answer key on the server.

// JSON.stringify replacer that drops `correctOption` from quiz questions.
// By the time a replacer sees a key, Mongoose documents have already been
// converted with toJSON(), so `this` is the plain question object.
function hideCorrectOption(key, value) {
  if (
    key === "correctOption" &&
    this &&
    typeof this.question === "string" &&
    Array.isArray(this.options)
  ) {
    return undefined;
  }
  return value;
}

// Express middleware: every JSON response passes through the replacer above,
// so an endpoint that returns a Course/Lesson can never leak the answer key by
// accident (populate, lean, new routes...). Tutors and admins are exempt,
// because the tutor editor needs correctOption to show and edit quizzes.
function quizAnswerGuard(req, res, next) {
  if (req.path.startsWith("/api/tutor") || req.path.startsWith("/api/admin")) return next();
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (body === undefined) return sendJson(body);
    const text = JSON.stringify(body, hideCorrectOption);
    if (!res.get("Content-Type")) res.set("Content-Type", "application/json; charset=utf-8");
    return res.send(text);
  };
  return next();
}

// Removes the quiz from lessons for people who have not enrolled.
function withoutQuizzes(course) {
  // toJSON() so the output matches what res.json(course) sent before.
  const plain = typeof course?.toJSON === "function" ? course.toJSON() : { ...course };
  plain.lessons = (plain.lessons || []).map(({ quiz, ...lesson }) => lesson); // eslint-disable-line no-unused-vars
  return plain;
}

// Validates the submitted answers and grades them against the stored quiz.
// Returns { error } or { score, totalQuestions, percentage, questionResults }.
function gradeQuiz(quiz, answers) {
  const questions = quiz?.questions || [];
  if (!questions.length) return { error: "This lesson has no quiz" };
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    return { error: "Answer every question before submitting" };
  }

  for (const [index, answer] of answers.entries()) {
    const optionCount = questions[index].options?.length || 0;
    if (!Number.isInteger(answer) || answer < 0 || answer >= optionCount) {
      return { error: `Question ${index + 1} has an invalid answer` };
    }
  }

  const questionResults = questions.map((question, index) => answers[index] === question.correctOption);
  const score = questionResults.filter(Boolean).length;
  const totalQuestions = questions.length;
  return {
    score,
    totalQuestions,
    percentage: Math.round((score / totalQuestions) * 100),
    questionResults,
  };
}

module.exports = { quizAnswerGuard, withoutQuizzes, gradeQuiz };

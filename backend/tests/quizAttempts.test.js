const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "quiz-attempts-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const QuizAttempt = require("../models/QuizAttempt");
const User = require("../models/User");
const { gradeQuiz } = require("../utils/quizAccess");
const app = require("../app");

const studentId = "507f1f77bcf86cd799439041";
const otherStudentId = "507f1f77bcf86cd799439042";
const tutorId = "507f1f77bcf86cd799439043";
const courseId = "507f1f77bcf86cd799439050";
const lessonId = "507f1f77bcf86cd799439051";
const token = jwt.sign({ id: studentId, role: "student", tokenVersion: 0 }, process.env.JWT_SECRET);

let server;
let currentUser;
let enrolled;
let created;
let countFilter;
let findFilter;
let storedAttempts;
const original = {};

function makeCourse({ withQuiz = true } = {}) {
  const fake = {
    _id: courseId,
    slug: "chinese",
    name: "Chinese",
    tutor: tutorId,
    moderationStatus: "published",
    lessons: [{
      _id: lessonId,
      title: "Lesson 1",
      quiz: withQuiz ? {
        _id: "507f1f77bcf86cd799439052",
        title: "Greetings",
        questions: [
          { _id: "q1", question: "What is ni hao?", type: "multiple_choice", options: [{ text: "bye" }, { text: "hello" }, { text: "thanks" }], correctOption: 1 },
          { _id: "q2", question: "Ni hao means hello", type: "true_false", options: [{ text: "True" }, { text: "False" }], correctOption: 0 },
        ],
      } : null,
    }],
    save: async function save() { return this; },
    toJSON() { return JSON.parse(JSON.stringify({ ...this, save: undefined, toJSON: undefined, toObject: undefined })); },
  };
  fake.toObject = fake.toJSON;
  fake.lessons.id = (id) => fake.lessons.find((lesson) => String(lesson._id) === String(id));
  return fake;
}
let course;

async function call(method, path, body, authorization = token) {
  const headers = { "Content-Type": "application/json" };
  if (authorization) headers.Authorization = `Bearer ${authorization}`;
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

test.before(async () => {
  Object.assign(original, {
    findById: User.findById, findOne: Course.findOne, find: Course.find, exists: Enrollment.exists,
    create: QuizAttempt.create, countDocuments: QuizAttempt.countDocuments, attemptFind: QuizAttempt.find,
  });
  User.findById = () => ({ select: async () => currentUser });
  Enrollment.exists = async () => enrolled;
  Course.findOne = async () => course;
  Course.find = () => ({ sort: async () => [course] });
  QuizAttempt.countDocuments = async (filter) => { countFilter = filter; return storedAttempts.length; };
  QuizAttempt.create = async (doc) => { created.push(doc); return { _id: "attempt-id", submittedAt: new Date("2026-09-19T10:00:00Z"), ...doc }; };
  QuizAttempt.find = (filter) => { findFilter = filter; const chain = { sort: () => chain, limit: () => chain, lean: async () => storedAttempts }; return chain; };
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = original.findById; Course.findOne = original.findOne; Course.find = original.find; Enrollment.exists = original.exists;
  QuizAttempt.create = original.create; QuizAttempt.countDocuments = original.countDocuments; QuizAttempt.find = original.attemptFind;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(() => {
  currentUser = { _id: studentId, role: "student", tokenVersion: 0, accountStatus: "approved" };
  enrolled = true;
  course = makeCourse();
  created = [];
  storedAttempts = [];
  countFilter = null;
  findFilter = null;
});

const quizUrl = "/api/quizzes/chinese/lessons/0/attempts";

test("gradeQuiz scores answers and validates them", () => {
  const quiz = makeCourse().lessons[0].quiz;
  assert.deepEqual(gradeQuiz(quiz, [1, 0]), { score: 2, totalQuestions: 2, percentage: 100, questionResults: [true, true] });
  assert.equal(gradeQuiz(quiz, [0, 1]).percentage, 0);
  assert.equal(gradeQuiz(quiz, [1, 1]).percentage, 50);
  for (const bad of [[1], [1, 0, 0], [1, 5], [1, -1], [1, "0"], [1, null], "1,0", undefined]) {
    assert.ok(gradeQuiz(quiz, bad).error, `expected an error for ${JSON.stringify(bad)}`);
  }
  assert.ok(gradeQuiz({ questions: [] }, []).error);
});

test("students never receive correctOption from course endpoints", async () => {
  const detail = await call("GET", "/api/courses/chinese");
  assert.equal(detail.status, 200);
  assert.equal(detail.body.lessons[0].quiz.questions.length, 2);
  assert.equal(detail.body.lessons[0].quiz.questions[0].options[1].text, "hello");
  assert.equal(detail.text.includes("correctOption"), false);

  const list = await call("GET", "/api/courses", undefined, null);
  assert.equal(list.status, 200);
  assert.equal(list.text.includes("correctOption"), false);
  assert.equal(list.body[0].lessons[0].quiz, undefined, "public list has no quiz at all");

  enrolled = false;
  const preview = await call("GET", "/api/courses/chinese", undefined, null);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.lessons[0].quiz, undefined, "visitors who are not enrolled cannot read the quiz");
});

test("the tutor still receives correctOption so the quiz editor works", async () => {
  currentUser = { _id: tutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  const tutorToken = jwt.sign({ id: tutorId, role: "tutor", tokenVersion: 0 }, process.env.JWT_SECRET);
  const response = await call("PATCH", `/api/tutor/courses/${courseId}/lessons/${lessonId}`, { title: "Lesson 1" }, tutorToken);
  assert.equal(response.status, 200);
  assert.equal(response.body.lessons[0].quiz.questions[0].correctOption, 1);
  assert.equal(response.body.lessons[0].quiz.questions[1].correctOption, 0);
});

test("submitting a quiz is graded by the server and stored for the signed-in student", async () => {
  storedAttempts = [{}, {}]; // two earlier attempts
  const response = await call("POST", quizUrl, { answers: [1, 1], student: otherStudentId, score: 2, percentage: 100 });
  assert.equal(response.status, 201);
  assert.equal(response.text.includes("correctOption"), false);
  assert.deepEqual(response.body.attempt.questionResults, [true, false]);
  assert.equal(response.body.attempt.score, 1);
  assert.equal(response.body.attempt.totalQuestions, 2);
  assert.equal(response.body.attempt.percentage, 50);
  assert.equal(response.body.attempt.correctCount, 1);
  assert.equal(response.body.attempt.wrongCount, 1);
  assert.equal(response.body.attempt.attemptNumber, 3);

  assert.equal(created.length, 1);
  assert.equal(String(created[0].student), studentId, "student comes from the token, not the body");
  assert.equal(String(created[0].course), courseId);
  assert.equal(String(created[0].lessonId), lessonId);
  assert.deepEqual(created[0].answers, [1, 1]);
  assert.equal(created[0].score, 1, "score comes from grading, not the body");
  assert.equal(String(countFilter.student), studentId);
});

test("invalid submissions are rejected and nothing is stored", async () => {
  for (const answers of [[1], [1, 0, 0], [1, 9], [1, "0"], [1, null], "1,0"]) {
    const response = await call("POST", quizUrl, { answers });
    assert.equal(response.status, 400, JSON.stringify(answers));
  }
  assert.equal((await call("POST", quizUrl, {})).status, 400);
  assert.equal(created.length, 0);
});

test("only enrolled students can take a quiz that exists", async () => {
  enrolled = false;
  assert.equal((await call("POST", quizUrl, { answers: [1, 0] })).status, 403);
  assert.equal((await call("GET", quizUrl)).status, 403);
  enrolled = true;

  assert.equal((await call("POST", quizUrl, { answers: [1, 0] }, null)).status, 401);

  currentUser = { _id: tutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  assert.equal((await call("POST", quizUrl, { answers: [1, 0] })).status, 403);
  currentUser = { _id: studentId, role: "student", tokenVersion: 0, accountStatus: "approved" };

  course = makeCourse({ withQuiz: false });
  assert.equal((await call("POST", quizUrl, { answers: [] })).status, 404);
  course = makeCourse();
  assert.equal((await call("POST", "/api/quizzes/chinese/lessons/9/attempts", { answers: [1, 0] })).status, 404);
  assert.equal(created.length, 0);
});

test("a student only ever reads their own results", async () => {
  storedAttempts = [
    { _id: "a3", attemptNumber: 3, score: 1, totalQuestions: 2, percentage: 50, submittedAt: new Date("2026-09-19T12:00:00Z"), student: otherStudentId, answers: [0, 0] },
    { _id: "a2", attemptNumber: 2, score: 2, totalQuestions: 2, percentage: 100, submittedAt: new Date("2026-09-19T11:00:00Z") },
    { _id: "a1", attemptNumber: 1, score: 0, totalQuestions: 2, percentage: 0, submittedAt: new Date("2026-09-19T10:00:00Z") },
  ];
  const response = await call("GET", `${quizUrl}?student=${otherStudentId}`);
  assert.equal(response.status, 200);
  assert.equal(String(findFilter.student), studentId, "the query string cannot change whose results are read");
  assert.equal(response.body.attemptCount, 3);
  assert.equal(response.body.latest.attemptNumber, 3);
  assert.equal(response.body.best.attemptNumber, 2);
  assert.equal(response.body.attempts[0].wrongCount, 1);
  assert.equal(response.text.includes(otherStudentId), false, "attempt views never expose student ids or answers");
  assert.equal(response.text.includes("correctOption"), false);
});

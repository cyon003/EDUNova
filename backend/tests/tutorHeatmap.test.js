const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "tutor-heatmap-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const User = require("../models/User");
const app = require("../app");

const tutorId = "507f1f77bcf86cd799439081";
const otherTutorId = "507f1f77bcf86cd799439082";
const courseId = "507f1f77bcf86cd799439083";
const lessonId = "507f1f77bcf86cd799439084";
const collectingLessonId = "507f1f77bcf86cd799439085";
const emptyLessonId = "507f1f77bcf86cd799439086";
let currentUser;
let server;
let originals;

const auth = (id, role = "tutor") => jwt.sign({ id, role, tokenVersion: 0 }, process.env.JWT_SECRET);
const course = { _id: courseId, tutor: tutorId, name: "Owned course", category: "Science", thumbnail: "/uploads/course-covers/course.jpg", lessons: [{ _id: lessonId, title: "Lesson 1" }, { _id: collectingLessonId, title: "Lesson 2" }, { _id: emptyLessonId, title: "Lesson 3" }] };
const secondCourse = { ...course, _id: "507f1f77bcf86cd799439090", name: "Second course", lessons: [{ _id: lessonId, title: "Different topic" }] };
const emptyCourse = { ...course, _id: "507f1f77bcf86cd799439091", name: "Empty course" };
const enrollments = [];
const signals = [
  { course: secondCourse._id, lessonId, student: "second-student", confusionFeedback: null, aiPrediction: {prediction:"confused",confusionProbability:0.8,clearProbability:0.2,modelVersion:"latest",predictedAt:new Date("2026-09-08")} },
  { course: secondCourse._id, lessonId, student: "second-student", aiPrediction: {prediction:"clear",confusionProbability:0.2,clearProbability:0.8,modelVersion:"older",predictedAt:new Date("2026-09-01")} },
  { course: courseId, lessonId:"deleted-lesson", student:"orphan", aiPrediction:{prediction:"clear",confusionProbability:0.2,clearProbability:0.8} },
  { course: courseId, lessonId: emptyLessonId, student:"null-feedback", confusionFeedback:null },
  ...[null, {}, {prediction:"clear",confusionProbability:-1,clearProbability:2}, {prediction:"other",confusionProbability:0.5,clearProbability:0.5}].map(aiPrediction=>({course:courseId,lessonId:emptyLessonId,student:"invalid",aiPrediction})),
  ...Array.from({ length: 5 }, (_, index) => ({ course: courseId, lessonId, student: `student-clear-${index}`, aiPrediction: { prediction: "clear", confusionProbability: 0.2, clearProbability: 0.8, modelVersion: "3b-v1", predictedAt: new Date() } })),
  ...Array.from({ length: 5 }, (_, index) => ({ course: courseId, lessonId, student: `student-confused-${index}`, aiPrediction: { prediction: "confused", confusionProbability: 0.8, clearProbability: 0.2, modelVersion: "3b-v1", predictedAt: new Date() } })),
  ...Array.from({ length: 3 }, (_, index) => ({ course: courseId, lessonId: collectingLessonId, student: `student-collecting-${index}`, aiPrediction: { prediction: "clear", confusionProbability: 0.2, clearProbability: 0.8, modelVersion: "3b-v1", predictedAt: new Date() } })),
  { course: courseId, lessonId: collectingLessonId, student: "invalid-signal", aiPrediction: { prediction: "confused" } },
  { course: courseId, lessonId: emptyLessonId, student: "feedback-only", confusionFeedback: "confused" },
];

function request(path, token) {
  return new Promise((resolve, reject) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const outgoing = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method: "GET", headers }, (response) => {
      let text = "";
      response.setEncoding("utf8"); response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null }));
    });
    outgoing.on("error", reject); outgoing.end();
  });
}

test.before(async () => {
  originals = { user: User.findById, course: Course.find, enrollment: Enrollment.find, signal: LearningSignal.find };
  User.findById = () => ({ select: async () => currentUser });
  Course.find = (filter) => ({ sort: async () => String(filter.tutor) === String(currentUser._id) && String(currentUser._id) === tutorId ? [course, secondCourse, emptyCourse] : [] });
  Enrollment.find = () => ({ populate() { return this; }, sort: async () => enrollments });
  LearningSignal.find = () => ({ lean: async () => signals });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originals.user; Course.find = originals.course; Enrollment.find = originals.enrollment; LearningSignal.find = originals.signal;
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => { currentUser = { _id: tutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" }; });

test("tutor analytics aggregates owned lesson predictions without student identities", async () => {
  const response = await request("/api/tutor/analytics", auth(tutorId));
  assert.equal(response.status, 200);
  assert.equal(response.body.heatmapCourses[0].courseTitle, "Owned course");
  assert.equal(response.body.heatmapCourses[0].courseCover, "/uploads/course-covers/course.jpg");
  assert.equal(response.body.heatmapCourses[0].lessons.length, 2);
  assert.equal(response.body.heatmapCourses[0].lessons[0].lessonTitle, "Lesson 1");
  assert.equal(response.body.heatmapCourses[0].lessons[0].predictionCount, 10);
  assert.equal(response.body.heatmapCourses[0].lessons[0].predictedClear, 5);
  assert.equal(response.body.heatmapCourses[0].lessons[0].predictedConfused, 5);
  assert.equal(response.body.heatmapCourses[0].lessons[0].confusionRate, 50);
  assert.equal(response.body.heatmapCourses[0].lessons[1].lessonTitle, "Lesson 2");
  assert.equal(response.body.heatmapCourses[0].lessons[1].predictionCount, 3);
  assert.equal("student" in response.body.heatmapCourses[0].lessons[0], false);
});

test("heatmap rejects unauthenticated users and non-tutors", async () => {
  assert.equal((await request("/api/tutor/analytics")).status, 401);
  currentUser = { _id: tutorId, role: "student", tokenVersion: 0, accountStatus: "approved" };
  assert.equal((await request("/api/tutor/analytics", auth(tutorId, "student"))).status, 403);
  currentUser = { _id: otherTutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  assert.deepEqual((await request("/api/tutor/analytics", auth(otherTutorId))).body.heatmapCourses, []);
});

test("course boundaries, distinct students, empty courses and latest model metadata", async () => {
  const {body}=await request("/api/tutor/analytics",auth(tutorId));
  assert.equal(body.heatmapCourses.length,3);
  assert.equal(body.heatmapCourses[1].lessons[0].lessonTitle,"Different topic");
  assert.equal(body.heatmapCourses[1].lessons[0].predictionCount,2);
  assert.equal(body.heatmapCourses[1].lessons[0].modelVersion,"latest");
  assert.equal(body.heatmapCourses[1].totalStudentsAnalyzed,1);
  assert.equal(body.heatmapCourses[1].overallConfusionRate,null);
  assert.deepEqual(body.heatmapCourses[2].lessons,[]);
  assert.equal(body.heatmapCourses[0].totalStudentsAnalyzed,13);
  assert.equal(body.totalStudentsAnalyzed,14);
  assert.equal(body.heatmapCourses[0].lessons.some(item=>item.lessonId===emptyLessonId),false);
  assert.equal(JSON.stringify(body).includes("second-student"),false);
});

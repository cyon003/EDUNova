const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "tutor-heatmap-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const Exposure = require("../models/LessonVideoExposure");
const ConfusionEvent = require("../models/ConfusionEvent");
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
  originals = { user: User.findById, course: Course.find, enrollment: Enrollment.find, signal: LearningSignal.find, events: ConfusionEvent.aggregate, exposure: Exposure.find };
  User.findById = () => ({ select: async () => currentUser });
  Course.find = (filter) => ({ sort: async () => String(filter.tutor) === String(currentUser._id) && String(currentUser._id) === tutorId ? [course, secondCourse, emptyCourse] : [] });
  Enrollment.find = () => ({ populate() { return this; }, sort: async () => enrollments });
  LearningSignal.find = () => ({ lean: async () => signals });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originals.user; Course.find = originals.course; Enrollment.find = originals.enrollment; LearningSignal.find = originals.signal; ConfusionEvent.aggregate = originals.events; Exposure.find = originals.exposure;
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => { Exposure.find = () => ({ select() { return this; }, lean: async () => signals.filter(s => ["clear","confused"].includes(s.aiPrediction?.prediction) && s.aiPrediction.confusionProbability >= 0 && s.aiPrediction.confusionProbability <= 1 && s.aiPrediction.clearProbability >= 0 && s.aiPrediction.clearProbability <= 1).map(s => ({...s, watchedRanges:[{startTimeSeconds:0,endTimeSeconds:1200}]})) }); ConfusionEvent.aggregate = async () => []; for (const item of [course, secondCourse, emptyCourse]) for (const lesson of item.lessons) delete lesson.topics; currentUser = { _id: tutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" }; });

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

const topicA = "507f1f77bcf86cd799439092", topicB = "507f1f77bcf86cd799439093", deletedTopic = "507f1f77bcf86cd799439094";
const topics = () => [{ _id: topicB, title: "Current While Loop title", startTimeSeconds: 720, endTimeSeconds: 960 }, { _id: topicA, title: "Current For Loop title", startTimeSeconds: 960, endTimeSeconds: 1200 }];
const eventGroup = (student, topicId = topicB, extras = {}) => ({ _id: { course: courseId, lessonId, topicId, student, ...extras }, latestConfusionAt: new Date("2026-09-17T12:00:00Z") });

test("topic rates use distinct observed students, current topic order and RF events only", async () => {
  course.lessons[0].topics = topics();
  let calls = 0, pipeline;
  ConfusionEvent.aggregate = async value => {
    calls++; pipeline = value;
    return [
      ...Array.from({ length: 5 }, (_, i) => eventGroup(`student-clear-${i}`)),
      ...Array.from({ length: 3 }, (_, i) => eventGroup(`student-confused-${i}`)),
      eventGroup("student-clear-0"), eventGroup("student-clear-0"),
      eventGroup("not-observed"), eventGroup("student-clear-0", topicA),
      { ...eventGroup("student-clear-0"), latestConfusionAt: new Date("2026-09-18T12:00:00Z") },
    ];
  };
  const { status, body } = await request("/api/tutor/analytics", auth(tutorId));
  assert.equal(status, 200); assert.equal(calls, 1);
  assert.deepEqual(pipeline[0].$match.course.$in, [courseId, secondCourse._id, emptyCourse._id]);
  assert.equal(pipeline[0].$match.source, "random_forest"); assert.equal(pipeline[0].$match.prediction, "confused");
  assert.deepEqual(pipeline[0].$match.confusionProbability, { $gte: 0, $lte: 1 });
  assert.equal(pipeline[1].$group._id.student, "$student");
  const lesson = body.heatmapCourses[0].lessons[0];
  assert.equal(lesson.predictionCount, 10); assert.equal(lesson.confusionRate, 50); // Existing lesson metric unchanged.
  assert.equal(lesson.observedStudents, 10); // Enrollment fixture is empty; enrollment is not the denominator.
  assert.deepEqual(lesson.topics.map(t => t.topicId), [topicB, topicA]);
  assert.equal(lesson.topics[0].title, "Current While Loop title");
  assert.equal(lesson.topics[0].confusedStudents, 8); assert.equal(lesson.topics[0].confusionRate, 80);
  assert.equal(lesson.topics[0].sampleSufficient, true);
  assert.equal(lesson.topics[0].latestConfusionAt, "2026-09-18T12:00:00.000Z");
  assert.equal(lesson.topics[1].confusionRate, 10);
  assert.doesNotMatch(JSON.stringify(body), /student-clear|student-confused|not-observed|signalsSnapshot|userMessage|assistantAnswer/);
});

test("deleted and null topic groups remain separate and never remap into edited ranges", async () => {
  course.lessons[0].topics = topics();
  ConfusionEvent.aggregate = async () => [eventGroup("student-clear-0", deletedTopic), eventGroup("student-clear-0", deletedTopic), eventGroup("student-clear-1", deletedTopic), eventGroup("student-clear-0", null), eventGroup("student-clear-0", null), eventGroup("student-clear-2", null)];
  const { body } = await request("/api/tutor/analytics", auth(tutorId));
  const lesson = body.heatmapCourses[0].lessons[0];
  assert.equal(lesson.historicalConfusionStudents, 2); assert.equal(lesson.unmappedConfusionStudents, 2);
  assert.deepEqual(lesson.topics.map(t => t.confusedStudents), [0, 0]);
  assert.deepEqual(lesson.topics.map(t => t.confusionRate), [0, 0]);
  assert.deepEqual(lesson.topics.map(t => t.latestConfusionAt), [null, null]);
  assert.doesNotMatch(JSON.stringify(body), new RegExp(deletedTopic));
});

test("topics appear with collecting state at zero or fewer than five observations", async () => {
  course.lessons[1].topics = topics(); course.lessons[2].topics = topics();
  const { body } = await request("/api/tutor/analytics", auth(tutorId));
  assert.equal(body.heatmapCourses[0].lessons.length, 3);
  assert.equal(body.heatmapCourses[0].predictionLessonCount, 2);
  assert.equal(body.heatmapCourses[0].overallConfusionRate, 38); // 5 / 13; empty topic lesson adds no predictions.
  const [collecting, empty] = body.heatmapCourses[0].lessons.slice(1);
  for (const [lesson, count] of [[collecting, 3], [empty, 0]]) for (const topic of lesson.topics) {
    assert.equal(topic.observedStudents, count); assert.equal(topic.confusedStudents, 0);
    assert.equal(topic.sampleSufficient, false); assert.equal(topic.confusionRate, null);
  }
  assert.deepEqual(body.heatmapCourses[0].lessons[0].topics, []);
});

test("topic events cannot cross owned course/lesson boundaries and duplicate predictions count once in denominator", async () => {
  secondCourse.lessons[0].topics = topics();
  ConfusionEvent.aggregate = async () => [eventGroup("second-student", topicB, { course: secondCourse._id }), eventGroup("student-clear-0", topicB, { course: "not-owned" }), eventGroup("student-clear-0", topicB, { lessonId: "deleted-lesson" })];
  const { body } = await request("/api/tutor/analytics", auth(tutorId));
  const topic = body.heatmapCourses[1].lessons[0].topics[0];
  assert.equal(topic.observedStudents, 1); assert.equal(topic.confusedStudents, 1); assert.equal(topic.sampleSufficient, false);
  currentUser = { _id: otherTutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  ConfusionEvent.aggregate = async () => { throw new Error("Should not query without owned courses"); };
  assert.deepEqual((await request("/api/tutor/analytics", auth(otherTutorId))).body.heatmapCourses, []);
});

test("exactly five distinct observed students permits a percentage, four does not", () => {
  const { topicAnalytics } = require("../services/topicAnalyticsService");
  const localCourse = { _id: courseId, lessons: [{ _id: lessonId, topics: topics() }] };
  const observations = Array.from({ length: 5 }, (_, i) => ({ course: courseId, lessonId, student: `observed-${i}` }));
  for (const count of [4, 5]) {
    const result = topicAnalytics([localCourse], observations.slice(0, count), [eventGroup("observed-0"), eventGroup("observed-0")], observations.slice(0,count).map(s => ({...s,watchedRanges:[{startTimeSeconds:720,endTimeSeconds:960}]}))).get(`${courseId}:${lessonId}`);
    assert.equal(result.topics[0].confusedStudents, 1); assert.equal(result.topics[0].sampleSufficient, count === 5);
    assert.equal(result.topics[0].confusionRate, count === 5 ? 20 : null);
  }
});

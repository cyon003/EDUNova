const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "learning-signal-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const User = require("../models/User");
const app = require("../app");

const ids = { student: "507f1f77bcf86cd799439061", otherStudent: "507f1f77bcf86cd799439062", tutor: "507f1f77bcf86cd799439063", admin: "507f1f77bcf86cd799439064", course: "507f1f77bcf86cd799439065", lesson: "507f1f77bcf86cd799439066", otherLesson: "507f1f77bcf86cd799439067" };
const originals = {};
const records = new Map();
let currentUser;
let enrolled;
let activeCourse;
let server;
let bulkOperations;
let deletedFilters;
let duplicateOnce;

const auth = (id, role) => jwt.sign({ id, role, tokenVersion: 0 }, process.env.JWT_SECRET);
const recordKey = (filter) => `${filter.student}:${filter.course}:${filter.lessonId}`;
const baseRecord = (filter) => ({ ...filter, maximumVideoProgressPercent: 0, activeTimeSeconds: 0, pauseCount: 0, replayCount: 0, visitCount: 0, lessonCompleted: false, confusionFeedback: null, feedbackUpdatedAt: null, lastInteractionAt: null });

function fakeCourse() {
  const lessons = [{ _id: ids.lesson, title: "Lesson", resources: [], deleteOne() { lessons.splice(lessons.indexOf(this), 1); } }];
  lessons.id = (id) => lessons.find((lesson) => String(lesson._id) === String(id));
  return { _id: ids.course, slug: "signal-course", tutor: ids.tutor, moderationStatus: "published", lessons, save: async function save() { return this; }, deleteOne: async function deleteOne() {} };
}

function request(method, pathname, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const headers = payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const outgoing = http.request({ hostname: "127.0.0.1", port: server.address().port, path: pathname, method, headers }, (response) => {
      let text = ""; response.setEncoding("utf8"); response.on("data", (chunk) => { text += chunk; }); response.on("end", () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null }));
    });
    outgoing.on("error", reject); if (payload) outgoing.write(payload); outgoing.end();
  });
}

test.before(async () => {
  originals.userFind = User.findById; originals.courseFindById = Course.findById; originals.courseFindOne = Course.findOne;
  originals.enrollmentFindOne = Enrollment.findOne; originals.enrollmentFindOneAndUpdate = Enrollment.findOneAndUpdate; originals.enrollmentExists = Enrollment.exists;
  originals.signalFindOne = LearningSignal.findOne; originals.signalUpdate = LearningSignal.findOneAndUpdate; originals.signalBulk = LearningSignal.bulkWrite; originals.signalDelete = LearningSignal.deleteMany;
  User.findById = () => ({ select: async () => currentUser });
  Course.findById = async (id) => String(id) === ids.course ? activeCourse : null;
  Course.findOne = async () => activeCourse;
  Enrollment.findOne = async () => enrolled ? { student: currentUser._id, course: ids.course } : null;
  Enrollment.exists = async () => false;
  Enrollment.findOneAndUpdate = () => ({ populate: async () => ({ completedLessons: [0], course: activeCourse }) });
  LearningSignal.findOne = async (filter) => records.get(recordKey(filter)) || null;
  LearningSignal.findOneAndUpdate = async (filter, update) => {
    if (duplicateOnce) { duplicateOnce = false; throw Object.assign(new Error("duplicate"), { code: 11000 }); }
    const key = recordKey(filter); const record = records.get(key) || baseRecord(filter);
    if (update.$max) for (const [field, value] of Object.entries(update.$max)) record[field] = Math.max(record[field] || 0, value);
    if (update.$inc) for (const [field, value] of Object.entries(update.$inc)) record[field] = (record[field] || 0) + value;
    if (update.$set) Object.assign(record, update.$set);
    records.set(key, record); return record;
  };
  LearningSignal.bulkWrite = async (operations) => { bulkOperations = operations; return { modifiedCount: operations.length }; };
  LearningSignal.deleteMany = async (filter) => { deletedFilters.push(filter); return { deletedCount: 1 }; };
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originals.userFind; Course.findById = originals.courseFindById; Course.findOne = originals.courseFindOne;
  Enrollment.findOne = originals.enrollmentFindOne; Enrollment.findOneAndUpdate = originals.enrollmentFindOneAndUpdate; Enrollment.exists = originals.enrollmentExists;
  LearningSignal.findOne = originals.signalFindOne; LearningSignal.findOneAndUpdate = originals.signalUpdate; LearningSignal.bulkWrite = originals.signalBulk; LearningSignal.deleteMany = originals.signalDelete;
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => { currentUser = { _id: ids.student, role: "student", tokenVersion: 0, accountStatus: "approved" }; enrolled = true; activeCourse = fakeCourse(); records.clear(); bulkOperations = []; deletedFilters = []; duplicateOnce = false; });

test("LearningSignal schema separates its label and enforces one student-course-lesson record", () => {
  const unique = LearningSignal.schema.indexes().find(([fields, options]) => fields.student === 1 && fields.course === 1 && fields.lessonId === 1 && options.unique);
  assert.ok(unique);
  assert.equal(LearningSignal.schema.path("confusionFeedback").options.enum.includes("confused"), true);
  assert.equal(LearningSignal.schema.path("maximumVideoProgressPercent").options.max, 100);
});

test("learning signal endpoints require authentication and student role", async () => {
  assert.equal((await request("GET", `/api/learning-signals/${ids.course}/${ids.lesson}`)).status, 401);
  for (const role of ["tutor", "admin"]) {
    currentUser = { _id: ids[role], role, tokenVersion: 0, accountStatus: "approved" };
    assert.equal((await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}`, { visitCountDelta: 1 }, auth(ids[role], role))).status, 403);
  }
});

test("enrollment and course-lesson relationship are enforced", async () => {
  enrolled = false;
  assert.equal((await request("GET", `/api/learning-signals/${ids.course}/${ids.lesson}`, undefined, auth(ids.student, "student"))).status, 403);
  enrolled = true;
  assert.equal((await request("GET", `/api/learning-signals/${ids.course}/${ids.otherLesson}`, undefined, auth(ids.student, "student"))).status, 404);
  assert.equal((await request("GET", `/api/learning-signals/not-an-id/${ids.lesson}`, undefined, auth(ids.student, "student"))).status, 400);
});

test("initial state, atomic updates, maximum progress, and student isolation are preserved", async () => {
  const token = auth(ids.student, "student");
  const initial = await request("GET", `/api/learning-signals/${ids.course}/${ids.lesson}`, undefined, token);
  assert.equal(initial.status, 200); assert.equal(initial.body.visitCount, 0); assert.equal(initial.body.confusionFeedback, null);
  assert.equal((await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}`, { maximumVideoProgressPercent: 80, activeTimeSecondsDelta: 25, pauseCountDelta: 2, replayCountDelta: 1, visitCountDelta: 1 }, token)).status, 200);
  await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}`, { maximumVideoProgressPercent: 30, activeTimeSecondsDelta: 10 }, token);
  const saved = records.get(`${ids.student}:${ids.course}:${ids.lesson}`);
  assert.equal(saved.maximumVideoProgressPercent, 80); assert.equal(saved.activeTimeSeconds, 35); assert.equal(saved.visitCount, 1); assert.equal(records.size, 1);
  currentUser = { _id: ids.otherStudent, role: "student", tokenVersion: 0, accountStatus: "approved" };
  const isolated = await request("GET", `/api/learning-signals/${ids.course}/${ids.lesson}`, undefined, auth(ids.otherStudent, "student"));
  assert.equal(isolated.body.maximumVideoProgressPercent, 0);
});

test("concurrent upsert duplicate-key races retry without creating a second record", async () => {
  duplicateOnce = true;
  const response = await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}`, { visitCountDelta: 1 }, auth(ids.student, "student"));
  assert.equal(response.status, 200); assert.equal(records.size, 1); assert.equal(response.body.visitCount, 1);
});

test("numeric caps, malformed values, unknown fields, and client identity/completion are rejected", async () => {
  const token = auth(ids.student, "student");
  const invalidBodies = [
    { maximumVideoProgressPercent: 101 }, { activeTimeSecondsDelta: -1 }, { pauseCountDelta: 1.5 },
    { replayCountDelta: "1" }, { activeTimeSecondsDelta: 301 }, { visitCountDelta: 2 },
    { studentId: ids.otherStudent }, { lessonCompleted: true }, { sources: [] },
  ];
  for (const body of invalidBodies) assert.equal((await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}`, body, token)).status, 400);
});

test("feedback is optional, persists, can change, and rejects unknown fields", async () => {
  const token = auth(ids.student, "student");
  assert.equal((await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}/feedback`, { feedback: "clear" }, token)).body.confusionFeedback, "clear");
  assert.equal((await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}/feedback`, { feedback: "confused" }, token)).body.confusionFeedback, "confused");
  assert.equal((await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}/feedback`, { feedback: "maybe" }, token)).status, 400);
  assert.equal((await request("PATCH", `/api/learning-signals/${ids.course}/${ids.lesson}/feedback`, { feedback: "clear", studentId: ids.otherStudent }, token)).status, 400);
});

test("existing progress workflow synchronizes trusted lesson completion", async () => {
  const response = await request("PATCH", "/api/enrollments/signal-course/progress", { completedLessons: [0] }, auth(ids.student, "student"));
  assert.equal(response.status, 200); assert.equal(bulkOperations.length, 1);
  assert.equal(bulkOperations[0].updateOne.update.$set.lessonCompleted, true);
  assert.equal(bulkOperations[0].updateOne.upsert, true);
});

test("lesson and course deletion clean signals while resource deletion preserves them", async () => {
  currentUser = { _id: ids.tutor, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  const tutorToken = auth(ids.tutor, "tutor");
  assert.equal((await request("DELETE", `/api/tutor/courses/${ids.course}/lessons/${ids.lesson}`, undefined, tutorToken)).status, 200);
  assert.deepEqual(deletedFilters.at(-1), { course: ids.course, lessonId: ids.lesson });
  activeCourse = fakeCourse(); deletedFilters = [];
  activeCourse.lessons[0].resources = [{ _id: ids.otherLesson, storedName: "missing.pdf", deleteOne() { activeCourse.lessons[0].resources.length = 0; } }];
  activeCourse.lessons[0].resources.id = (id) => activeCourse.lessons[0].resources.find((item) => String(item._id) === String(id));
  assert.equal((await request("DELETE", `/api/tutor/courses/${ids.course}/lessons/${ids.lesson}/resources/${ids.otherLesson}`, undefined, tutorToken)).status, 200);
  assert.equal(deletedFilters.length, 0);
  activeCourse = fakeCourse(); deletedFilters = [];
  assert.equal((await request("DELETE", `/api/tutor/courses/${ids.course}`, undefined, tutorToken)).status, 204);
  assert.deepEqual(deletedFilters.at(-1), { course: ids.course });
  const adminSource = await fs.promises.readFile(path.join(__dirname, "..", "routes", "adminRoutes.js"), "utf8");
  assert.match(adminSource, /LearningSignal\.deleteMany\(\{ course: course\._id \}\)/);
});

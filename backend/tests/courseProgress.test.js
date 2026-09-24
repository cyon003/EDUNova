const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "course-progress-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LearningSignal = require("../models/LearningSignal");
const User = require("../models/User");
const { summarizeEnrollment } = require("../services/courseProgressService");
const app = require("../app");

const ids = {
  student: "507f1f77bcf86cd799439071",
  otherStudent: "507f1f77bcf86cd799439072",
  tutor: "507f1f77bcf86cd799439073",
  firstCourse: "507f1f77bcf86cd799439074",
  secondCourse: "507f1f77bcf86cd799439075",
};
const courses = [
  { _id: ids.firstCourse, slug: "first-course", lessons: [{ _id: "lesson-1", title: "One" }, { _id: "lesson-2", title: "Two" }, { _id: "lesson-3", title: "Three" }] },
  { _id: ids.secondCourse, slug: "second-course", lessons: [{ _id: "lesson-4", title: "Four" }, { _id: "lesson-5", title: "Five" }] },
];
const originals = {};
let records;
let signalWrites;
let server;
let lastUpdateFilter;

const token = (id, role = "student") => jwt.sign({ id, role, tokenVersion: 0 }, process.env.JWT_SECRET);
const key = (student, course) => `${student}:${course}`;
const populate = (record) => record && ({ ...record, course: courses.find((item) => item._id === record.course) });

function request(method, pathname, body, authToken) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const headers = payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {};
    headers["X-Course-Version"] = "0";
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const outgoing = http.request({ hostname: "127.0.0.1", port: server.address().port, path: pathname, method, headers }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null }));
    });
    outgoing.on("error", reject);
    if (payload) outgoing.write(payload);
    outgoing.end();
  });
}

test.before(async () => {
  const mongoose = require("mongoose");
  test.mock.method(mongoose.connection, "transaction", async work => work());
  test.mock.method(Course, "updateOne", async () => ({ matchedCount: 1 }));
  originals.userFind = User.findById;
  originals.courseFind = Course.findOne;
  originals.enrollmentFind = Enrollment.find;
  originals.enrollmentFindOne = Enrollment.findOne;
  originals.enrollmentUpdate = Enrollment.findOneAndUpdate;
  originals.signalBulk = LearningSignal.bulkWrite;

  User.findById = (id) => ({ select: async () => ({ _id: id, role: id === ids.tutor ? "tutor" : "student", tokenVersion: 0, accountStatus: "approved" }) });
  Course.findOne = async (filter) => courses.find((item) => item.slug === filter.slug) || null;
  Enrollment.find = (filter) => ({ populate() { return this; }, sort: async () => [...records.values()].filter((item) => item.student === filter.student).map(populate) });
  Enrollment.findOne = (filter) => ({ populate: async () => populate(records.get(key(filter.student, filter.course))) });
  Enrollment.findOneAndUpdate = (filter, update) => ({ populate: async () => {
    lastUpdateFilter = filter;
    const record = records.get(key(filter.student, filter.course));
    if (!record || (filter.completedLessons?.$ne !== undefined && record.completedLessons.includes(filter.completedLessons.$ne))) return null;
    if (update.$addToSet?.completedLessons !== undefined) record.completedLessons.push(update.$addToSet.completedLessons);
    for (const [field, value] of Object.entries(update.$set || {})) {
      if (field.startsWith("completedLessonDates.")) record.completedLessonDates[field.split(".")[1]] = value;
      else record[field] = value;
    }
    if (update.$push?.recentActivity) record.recentActivity.push(...update.$push.recentActivity.$each);
    return populate(record);
  } });
  LearningSignal.bulkWrite = async (operations) => { signalWrites.push(...operations); return { modifiedCount: operations.length }; };
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originals.userFind;
  Course.findOne = originals.courseFind;
  Enrollment.find = originals.enrollmentFind;
  Enrollment.findOne = originals.enrollmentFindOne;
  Enrollment.findOneAndUpdate = originals.enrollmentUpdate;
  LearningSignal.bulkWrite = originals.signalBulk;
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => {
  records = new Map();
  signalWrites = [];
  lastUpdateFilter = null;
  for (const student of [ids.student, ids.otherStudent]) {
    records.set(key(student, ids.firstCourse), { _id: `${student}-enrollment`, student, course: ids.firstCourse, completedLessons: [], completedLessonDates: {}, recentActivity: [] });
  }
  records.set(key(ids.student, ids.secondCourse), { _id: "second-enrollment", student: ids.student, course: ids.secondCourse, completedLessons: [], completedLessonDates: {}, recentActivity: [] });
});

test("progress summary counts only distinct, existing lesson indexes", () => {
  const summary = summarizeEnrollment({ course: courses[0], completedLessons: [0, 0, 2, 5, -1, "1"] });
  assert.deepEqual(summary.completedLessons, [0, 2]);
  assert.equal(summary.completedLessonCount, 2);
  assert.equal(summary.totalLessons, 3);
  assert.equal(summary.completionPercentage, 67);
  const mongooseEnrollment = new Enrollment({ student: ids.student, course: ids.firstCourse, completedLessonDates: { "0": new Date("2026-09-17T00:00:00.000Z") } });
  assert.equal(mongooseEnrollment.toObject({ flattenMaps: true }).completedLessonDates["0"].toISOString(), "2026-09-17T00:00:00.000Z");
});

test("student course progress is isolated by authenticated account and course", async () => {
  const studentToken = token(ids.student);
  const otherToken = token(ids.otherStudent);
  const completed = await request("POST", "/api/enrollments/first-course/lessons/0/complete", undefined, studentToken);
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(completed.body.completionPercentage, 33);
  assert.equal(completed.body.completedLessonCount, 1);
  assert.equal(lastUpdateFilter.student, ids.student);
  assert.ok(completed.body.completedLessonDates["0"]);
  assert.equal(signalWrites.length, 3);

  const mine = await request("GET", "/api/enrollments/me", undefined, studentToken);
  const theirs = await request("GET", "/api/enrollments/me", undefined, otherToken);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.length, 2);
  assert.equal(mine.body.find((item) => item.course.slug === "first-course").completionPercentage, 33);
  assert.equal(mine.body.find((item) => item.course.slug === "second-course").completionPercentage, 0);
  assert.equal(theirs.body.length, 1);
  assert.equal(theirs.body[0].completionPercentage, 0);
  assert.deepEqual(records.get(key(ids.otherStudent, ids.firstCourse)).completedLessons, []);

  const secondCourse = await request("POST", "/api/enrollments/second-course/lessons/0/complete", undefined, studentToken);
  assert.equal(secondCourse.status, 200);
  assert.equal(secondCourse.body.completionPercentage, 50);
  assert.deepEqual(records.get(key(ids.student, ids.firstCourse)).completedLessons, [0]);
});

test("completing a lesson again is idempotent and does not change its completion date", async () => {
  const studentToken = token(ids.student);
  const first = await request("POST", "/api/enrollments/first-course/lessons/1/complete", undefined, studentToken);
  const second = await request("POST", "/api/enrollments/first-course/lessons/1/complete", undefined, studentToken);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.completedLessons, [1]);
  assert.equal(second.body.completedLessonDates["1"], first.body.completedLessonDates["1"]);
  assert.equal(records.get(key(ids.student, ids.firstCourse)).recentActivity.length, 1);
  assert.equal(signalWrites.length, 3);
});

test("invalid, unauthorized, and unenrolled completion attempts cannot change progress", async () => {
  const studentToken = token(ids.student);
  assert.equal((await request("POST", "/api/enrollments/first-course/lessons/0/complete")).status, 401);
  assert.equal((await request("POST", "/api/enrollments/first-course/lessons/0/complete", undefined, token(ids.tutor, "tutor"))).status, 403);
  assert.equal((await request("POST", "/api/enrollments/first-course/lessons/0/complete", { studentId: ids.otherStudent }, studentToken)).status, 400);
  assert.equal((await request("POST", "/api/enrollments/first-course/lessons/3/complete", undefined, studentToken)).status, 404);
  assert.equal((await request("POST", "/api/enrollments/first-course/lessons/-1/complete", undefined, studentToken)).status, 404);
  assert.equal((await request("PATCH", "/api/enrollments/first-course/progress", { completedLessons: [0] }, studentToken)).status, 400);
  assert.equal((await request("PATCH", "/api/enrollments/first-course/progress", { studentId: ids.otherStudent }, studentToken)).status, 400);
  records.delete(key(ids.student, ids.firstCourse));
  assert.equal((await request("POST", "/api/enrollments/first-course/lessons/0/complete", undefined, studentToken)).status, 404);
  assert.deepEqual(records.get(key(ids.otherStudent, ids.firstCourse)).completedLessons, []);
  assert.equal(signalWrites.length, 0);
});

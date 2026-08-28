const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "lesson-content-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const User = require("../models/User");
const app = require("../app");

const tutorId = "507f1f77bcf86cd799439021";
const otherTutorId = "507f1f77bcf86cd799439022";
let currentUser = { _id: tutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
const token = jwt.sign({ id: tutorId, role: "tutor", tokenVersion: 0 }, process.env.JWT_SECRET);
const studentToken = jwt.sign({ id: tutorId, role: "student", tokenVersion: 0 }, process.env.JWT_SECRET);
let server;
let originalFindById;
let originalFindOne;

function request(method, requestPath, body, authorization = token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const address = server.address();
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${authorization}` };
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
    const outgoing = http.request({ hostname: "127.0.0.1", port: address.port, path: requestPath, method, headers }, (response) => {
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

function fakeCourse() {
  const lessons = [];
  lessons.id = (id) => lessons.find((lesson) => String(lesson._id) === String(id));
  return {
    _id: "507f1f77bcf86cd799439030",
    tutor: tutorId,
    moderationStatus: "published",
    lessons,
    save: async function save() { return this; },
  };
}

test.before(async () => {
  originalFindById = User.findById;
  originalFindOne = Course.findOne;
  User.findById = () => ({ select: async () => currentUser });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originalFindById;
  Course.findOne = originalFindOne;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(() => {
  currentUser = { _id: tutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
});

test("lesson schema persists optional summary and transcript and enforces limits", async () => {
  const course = new Course({ slug: "schema-test", name: "Schema", category: "Test", description: "Test", level: "Beginner", duration: "1:00", rating: 0, lessons: [{ title: "Lesson", summary: "Tutor summary", transcript: "Tutor transcript" }] });
  assert.equal(course.lessons[0].summary, "Tutor summary");
  assert.equal(course.lessons[0].transcript, "Tutor transcript");
  course.lessons[0].summary = "s".repeat(5001);
  course.lessons[0].transcript = "t".repeat(50001);
  await assert.rejects(course.validate(), (error) => {
    assert.match(error.errors["lessons.0.summary"].message, /5000/);
    assert.match(error.errors["lessons.0.transcript"].message, /50000/);
    return true;
  });
});

test("tutor can save summary and transcript while creating a lesson", async () => {
  const course = fakeCourse();
  Course.findOne = async (filter) => {
    assert.equal(String(filter.tutor), tutorId);
    return course;
  };
  Course.findById = async () => course;
  const response = await request("POST", `/api/tutor/courses/${course._id}/lessons`, { title: "Video lesson", videoUrl: "https://example.com/lesson.mp4", summary: "  Tutor-written summary  ", transcript: "  Tutor-written transcript  " });
  assert.equal(response.status, 201);
  assert.equal(course.lessons[0].summary, "Tutor-written summary");
  assert.equal(course.lessons[0].transcript, "Tutor-written transcript");
});

test("owning tutor can edit persisted lesson content", async () => {
  const course = fakeCourse();
  const lesson = { _id: "507f1f77bcf86cd799439031", title: "Lesson", summary: "Old", transcript: "Old transcript" };
  course.lessons.push(lesson);
  Course.findOne = async (filter) => {
    assert.equal(String(filter.tutor), tutorId);
    return course;
  };
  const response = await request("PATCH", `/api/tutor/courses/${course._id}/lessons/${lesson._id}`, { summary: "New summary", transcript: "New transcript" });
  assert.equal(response.status, 200);
  assert.equal(lesson.summary, "New summary");
  assert.equal(lesson.transcript, "New transcript");
});

test("lesson content rejects oversized values", async () => {
  Course.findOne = async () => fakeCourse();
  const response = await request("POST", "/api/tutor/courses/507f1f77bcf86cd799439030/lessons", { title: "Lesson", videoUrl: "https://example.com/lesson.mp4", summary: "s".repeat(5001) });
  assert.equal(response.status, 400);
  assert.match(response.body.message, /5000/);
});

test("students and non-owning tutors cannot edit lesson content", async () => {
  currentUser = { _id: tutorId, role: "student", tokenVersion: 0, accountStatus: "approved" };
  const roleDenied = await request("PATCH", "/api/tutor/courses/507f1f77bcf86cd799439030/lessons/507f1f77bcf86cd799439031", { summary: "No" }, studentToken);
  assert.equal(roleDenied.status, 403);

  currentUser = { _id: otherTutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  Course.findOne = async (filter) => {
    assert.equal(String(filter.tutor), otherTutorId);
    return null;
  };
  const ownershipDenied = await request("PATCH", "/api/tutor/courses/507f1f77bcf86cd799439030/lessons/507f1f77bcf86cd799439031", { summary: "No" }, jwt.sign({ id: otherTutorId, role: "tutor", tokenVersion: 0 }, process.env.JWT_SECRET));
  assert.equal(ownershipDenied.status, 404);
});

test("authorized student lesson response includes persisted summary and transcript", async () => {
  currentUser = { _id: tutorId, role: "student", tokenVersion: 0, accountStatus: "approved" };
  const course = fakeCourse();
  course.slug = "student-display";
  course.price = 0;
  course.moderationStatus = "published";
  course.lessons.push({ _id: "507f1f77bcf86cd799439032", title: "Video lesson", videoUrl: "https://example.com/video.mp4", summary: "Tutor summary", transcript: "Tutor transcript", resources: [] });
  Course.findOne = async (filter) => {
    assert.equal(filter.slug, "student-display");
    return course;
  };
  const response = await request("GET", "/api/courses/student-display/lessons/0", undefined, studentToken);
  assert.equal(response.status, 200);
  assert.equal(response.body.summary, "Tutor summary");
  assert.equal(response.body.transcript, "Tutor transcript");
});

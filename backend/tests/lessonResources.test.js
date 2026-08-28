const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "lesson-resource-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const app = require("../app");

const ids = { student: "507f1f77bcf86cd799439041", tutor: "507f1f77bcf86cd799439042", otherTutor: "507f1f77bcf86cd799439043" };
let currentUser;
let enrolled;
let server;
const originals = {};

function token(id, role) { return jwt.sign({ id, role, tokenVersion: 0 }, process.env.JWT_SECRET); }
function request(pathname, auth) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const outgoing = http.request({ hostname: "127.0.0.1", port: address.port, path: pathname, headers: { Authorization: `Bearer ${auth}` } }, (response) => {
      let body = ""; response.on("data", (chunk) => { body += chunk; }); response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    outgoing.on("error", reject); outgoing.end();
  });
}

function fakeCourse() {
  const resources = [{ _id: "507f1f77bcf86cd799439050", originalName: "missing.pdf", storedName: "missing.pdf", mimeType: "application/pdf", size: 10, toObject() { return { ...this }; } }];
  resources.id = (id) => resources.find((item) => String(item._id) === String(id));
  return { _id: "507f1f77bcf86cd799439044", slug: "protected-course", tutor: ids.tutor, lessons: [{ resources, primaryMedia: { originalName: "missing.mp4", storedName: "missing.mp4", mimeType: "video/mp4", storage: "course-videos" } }] };
}

test.before(async () => {
  originals.userFind = User.findById; originals.courseFind = Course.findOne; originals.enrollment = Enrollment.exists;
  User.findById = () => ({ select: async () => currentUser });
  Course.findOne = async () => fakeCourse();
  Enrollment.exists = async () => enrolled;
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
});
test.after(async () => { User.findById = originals.userFind; Course.findOne = originals.courseFind; Enrollment.exists = originals.enrollment; await new Promise((resolve) => server.close(resolve)); });

test("non-enrolled students cannot view or download protected lesson files", async () => {
  currentUser = { _id: ids.student, role: "student", tokenVersion: 0, accountStatus: "approved" }; enrolled = false;
  const response = await request("/api/courses/protected-course/lessons/0/resources/507f1f77bcf86cd799439050/download", token(ids.student, "student"));
  assert.equal(response.status, 403);
});

test("a tutor cannot access another tutor's course resources", async () => {
  currentUser = { _id: ids.otherTutor, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  const response = await request("/api/courses/protected-course/lessons/0/media", token(ids.otherTutor, "tutor"));
  assert.equal(response.status, 403);
});

test("authorized users receive a safe 404 for missing media and resources", async () => {
  currentUser = { _id: ids.student, role: "student", tokenVersion: 0, accountStatus: "approved" }; enrolled = true;
  assert.equal((await request("/api/courses/protected-course/lessons/0/media", token(ids.student, "student"))).status, 404);
  assert.equal((await request("/api/courses/protected-course/lessons/0/resources/507f1f77bcf86cd799439050/view", token(ids.student, "student"))).status, 404);
});

test("authorized users receive a short-lived backend media URL", async () => {
  currentUser = { _id: ids.student, role: "student", tokenVersion: 0, accountStatus: "approved" }; enrolled = true;
  const response = await request("/api/courses/protected-course/lessons/0/media-access", token(ids.student, "student"));
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.match(payload.url, /^http:\/\/127\.0\.0\.1:\d+\/api\/courses\/protected-course\/lessons\/0\/media\?token=/);
  assert.doesNotMatch(payload.url, /localhost:5173/);
});

test("schema preserves primary media metadata and reference roles", () => {
  const course = new Course({ slug: "media-schema", name: "Media", category: "Test", description: "Test", level: "Beginner", duration: "1:00", rating: 0, lessons: [{ title: "Lesson", primaryMedia: { originalName: "lesson.mp4", storedName: "uuid.mp4", mimeType: "video/mp4", size: 123, url: "/uploads/course-videos/uuid.mp4", storage: "course-videos" }, references: [{ label: "YouTube", url: "https://youtube.com/watch?v=dQw4w9WgXcQ" }] }] });
  assert.equal(course.lessons[0].primaryMedia.originalName, "lesson.mp4");
  assert.equal(course.lessons[0].references[0].label, "YouTube");
  course.lessons[0].primaryMediaRemoved = true;
  assert.equal(course.lessons[0].primaryMediaRemoved, true);
});

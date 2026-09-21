const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "lesson-content-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
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
let originalEnrollmentExists;

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

function multipartRequest(requestPath, fields, files, authorization = token) {
  return new Promise((resolve, reject) => {
    const boundary = `----edunova-${Date.now()}`;
    const parts = [];
    for (const [name, value] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    for (const file of files) parts.push(Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.content, Buffer.from("\r\n")]));
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const payload = Buffer.concat(parts);
    const address = server.address();
    const outgoing = http.request({ hostname: "127.0.0.1", port: address.port, path: requestPath, method: "POST", headers: { Authorization: `Bearer ${authorization}`, "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": payload.length } }, (response) => {
      let text = ""; response.setEncoding("utf8"); response.on("data", (chunk) => { text += chunk; }); response.on("end", () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null }));
    });
    outgoing.on("error", reject); outgoing.end(payload);
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
  originalEnrollmentExists = Enrollment.exists;
  Enrollment.exists = async () => true;
  User.findById = () => ({ select: async () => currentUser });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originalFindById;
  Course.findOne = originalFindOne;
  Enrollment.exists = originalEnrollmentExists;
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

test("tutor can upload main video and supporting document without extraction", async () => {
  const course = fakeCourse();
  Course.findOne = async () => course;
  Course.findById = async () => course;
  const response = await multipartRequest(`/api/tutor/courses/${course._id}/lessons`, { title: "Uploaded lesson", references: "[]", durationSeconds: "60" }, [
    { field: "video", name: "lesson.mp4", type: "video/mp4", content: Buffer.from("test-video") },
    { field: "resources", name: "guide.pdf", type: "application/pdf", content: Buffer.from("%PDF-test") },
  ]);
  assert.equal(response.status, 201);
  const lesson = course.lessons[0];
  assert.equal(lesson.primaryMedia.originalName, "lesson.mp4");
  assert.equal(lesson.duration, "1:00");
  assert.equal(lesson.resources[0].originalName, "guide.pdf");
  assert.equal(Object.keys(lesson.resources[0]).some((key) => key.startsWith("extract")), false);
  await Promise.all([
    fs.promises.unlink(path.join(__dirname, "..", "uploads", "course-videos", lesson.primaryMedia.storedName)),
    fs.promises.unlink(path.join(__dirname, "..", "uploads", "lesson-resources", lesson.resources[0].storedName)),
  ]);
});

test("owning tutor can confirm an older media duration and a replacement updates it", async () => {
  const course = fakeCourse();
  const lesson = { _id: "507f1f77bcf86cd799439033", title: "Older video", duration: "Provider managed", primaryMedia: { storedName: "old.mp4", storage: "lesson-resources" } };
  course.lessons.push(lesson);
  Course.findOne = async (filter) => { assert.equal(String(filter.tutor), tutorId); return course; };
  const invalid = await request("PATCH", `/api/tutor/courses/${course._id}/lessons/${lesson._id}`, { duration: "unknown" });
  assert.equal(invalid.status, 400);
  const confirmed = await request("PATCH", `/api/tutor/courses/${course._id}/lessons/${lesson._id}`, { title: "Older video", description: "", summary: "", transcript: "", references: [], duration: "1:00" });
  assert.equal(confirmed.status, 200);
  assert.equal(lesson.duration, "1:00");
  assert.equal(course.moderationStatus, "published");
  const replaced = await multipartRequest(`/api/tutor/courses/${course._id}/lessons/${lesson._id}/main-media`, { durationSeconds: "125" }, [
    { field: "video", name: "replacement.mp3", type: "audio/mpeg", content: Buffer.from("test-audio") },
  ]);
  assert.equal(replaced.status, 200);
  assert.equal(lesson.duration, "2:05");
  await fs.promises.unlink(path.join(__dirname, "..", "uploads", "course-videos", lesson.primaryMedia.storedName));
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

const sampleQuiz = { title: "Greetings", questions: [{ question: "What is ni hao?", type: "multiple_choice", options: ["hello", "bye"], correctOption: 0 }] };

test("tutor can save a quiz while creating a lesson", async () => {
  const course = fakeCourse();
  Course.findOne = async () => course;
  Course.findById = async () => course;
  const response = await multipartRequest(`/api/tutor/courses/${course._id}/lessons`, { title: "Quiz lesson", videoUrl: "https://example.com/lesson.mp4", quiz: JSON.stringify(sampleQuiz) }, []);
  assert.equal(response.status, 201);
  assert.equal(course.lessons[0].quiz.title, "Greetings");
  assert.deepEqual(course.lessons[0].quiz.questions[0].options, [{ text: "hello" }, { text: "bye" }]);
  assert.equal(course.lessons[0].quiz.questions[0].correctOption, 0);
});

test("owning tutor can add, change and remove a lesson quiz with PATCH", async () => {
  const course = fakeCourse();
  const lesson = { _id: "507f1f77bcf86cd799439032", title: "Lesson", quiz: null };
  course.lessons.push(lesson);
  Course.findOne = async () => course;
  const path = `/api/tutor/courses/${course._id}/lessons/${lesson._id}`;
  let response = await request("PATCH", path, { title: "Lesson", quiz: sampleQuiz });
  assert.equal(response.status, 200);
  assert.equal(lesson.quiz.questions.length, 1);
  response = await request("PATCH", path, { title: "Renamed" });
  assert.equal(lesson.quiz.questions.length, 1, "omitting quiz must leave it untouched");
  response = await request("PATCH", path, { quiz: null });
  assert.equal(response.status, 200);
  assert.equal(lesson.quiz, null);
});

test("lesson quiz must have at least one valid question", async () => {
  const course = fakeCourse();
  const lesson = { _id: "507f1f77bcf86cd799439033", title: "Lesson", quiz: null };
  course.lessons.push(lesson);
  Course.findOne = async () => course;
  const path = `/api/tutor/courses/${course._id}/lessons/${lesson._id}`;
  let response = await request("PATCH", path, { quiz: { title: "Empty", questions: [] } });
  assert.equal(response.status, 400);
  response = await request("PATCH", path, { quiz: { title: "Bad", questions: [{ question: "Q?", type: "multiple_choice", options: ["a", ""], correctOption: 0 }] } });
  assert.equal(response.status, 400);
  assert.equal(lesson.quiz, null);
});

const mergedTopics = [{ title: "Greeting", startTimeSeconds: 0, endTimeSeconds: 30 }];
test("lesson creation and editing preserve topics, quiz and duration together", async () => {
  const course = fakeCourse();
  Course.findOne = async () => course;
  Course.findById = async () => course;
  const created = await multipartRequest(`/api/tutor/courses/${course._id}/lessons`, {
    title: "Combined lesson", videoUrl: "https://example.com/video.mp4", durationSeconds: "60",
    topics: JSON.stringify(mergedTopics), quiz: JSON.stringify(sampleQuiz),
  }, []);
  assert.equal(created.status, 201);
  const lesson = course.lessons[0];
  lesson._id = "507f1f77bcf86cd799439034";
  assert.deepEqual(lesson.topics, mergedTopics);
  assert.equal(lesson.duration, "1:00");
  assert.equal(lesson.quiz.questions[0].correctOption, 0);
  const route = `/api/tutor/courses/${course._id}/lessons/${lesson._id}`;
  const updated = await request("PATCH", route, { topics: [{...mergedTopics[0], title: "Updated"}], quiz: {...sampleQuiz, title: "Updated quiz"} });
  assert.equal(updated.status, 200);
  assert.equal(lesson.topics[0].title, "Updated");
  assert.equal(lesson.quiz.title, "Updated quiz");
  assert.equal(lesson.duration, "1:00");
  assert.equal((await request("PATCH", route, { topics: [{...mergedTopics[0], endTimeSeconds: -1}], quiz: null })).status, 400);
  assert.equal(lesson.quiz.title, "Updated quiz", "invalid topics cannot remove the quiz");
  assert.equal((await request("PATCH", route, { topics: [], quiz: {questions: []} })).status, 400);
  assert.equal(lesson.topics.length, 1, "invalid quiz cannot erase topics");
  assert.equal((await request("PATCH", route, { quiz: null })).status, 200);
  assert.equal(lesson.topics.length, 1);
});

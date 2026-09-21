const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "quiz-media-test-secret-at-least-32-characters";
process.env.UPLOAD_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "edunova-quiz-media-"));

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const app = require("../app");

const tutorId = "507f1f77bcf86cd799439061";
const otherTutorId = "507f1f77bcf86cd799439062";
const studentId = "507f1f77bcf86cd799439063";
const courseId = "507f1f77bcf86cd799439070";
const lessonId = "507f1f77bcf86cd799439071";
const tokenFor = (id, role) => jwt.sign({ id, role, tokenVersion: 0 }, process.env.JWT_SECRET);
const mediaDirectory = path.join(process.env.UPLOAD_ROOT, "quiz-media");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let server;
let currentUser;
let enrolled;
let course;
const original = {};

function makeCourse() {
  const fake = {
    _id: courseId, slug: "chinese", tutor: tutorId, moderationStatus: "published",
    lessons: [{ _id: lessonId, title: "Lesson 1", quiz: null }],
    save: async function save() { return this; },
    toJSON() { return JSON.parse(JSON.stringify({ ...this, save: undefined, toJSON: undefined })); },
  };
  fake.lessons.id = (id) => fake.lessons.find((lesson) => String(lesson._id) === String(id));
  return fake;
}

// Puts a real file where the upload route would have put it.
function placeFile(prefix = courseId, extension = ".png", bytes = PNG) {
  fs.mkdirSync(mediaDirectory, { recursive: true });
  const storedName = `${prefix}-3f2b8c1e-9d4a-4c5b-8e6f-1a2b3c4d5e6f${extension}`.replace("3f2b8c1e", Math.random().toString(16).slice(2, 10).padEnd(8, "0"));
  fs.writeFileSync(path.join(mediaDirectory, storedName), bytes);
  return storedName;
}
const fileExists = (storedName) => fs.existsSync(path.join(mediaDirectory, storedName));
const waitForUnlink = () => new Promise((resolve) => setTimeout(resolve, 100));

const question = (media) => ({ question: "What is this?", type: "multiple_choice", options: ["a", "b"], correctOption: 1, ...(media === undefined ? {} : { media }) });

async function call(method, url, { body, form, authorization } = {}) {
  const headers = {};
  if (authorization !== null) headers.Authorization = `Bearer ${authorization || tokenFor(currentUser._id, currentUser.role)}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)) });
  const buffer = Buffer.from(await response.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buffer.toString("utf8")); } catch { /* binary response */ }
  return { status: response.status, headers: response.headers, buffer, body: json };
}

function fileForm(name, type, bytes) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  return form;
}

test.before(async () => {
  Object.assign(original, { findById: User.findById, findOne: Course.findOne, exists: Enrollment.exists });
  User.findById = () => ({ select: async () => currentUser });
  Course.findOne = async (filter) => {
    if (filter.tutor !== undefined && String(filter.tutor) !== String(course.tutor)) return null;
    return course;
  };
  Enrollment.exists = async () => enrolled;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = original.findById; Course.findOne = original.findOne; Enrollment.exists = original.exists;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(process.env.UPLOAD_ROOT, { recursive: true, force: true });
});

test.beforeEach(() => {
  currentUser = { _id: tutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  enrolled = true;
  course = makeCourse();
});

test("a tutor can upload a picture or audio clip for a quiz question", async () => {
  const upload = await call("POST", `/api/tutor/courses/${courseId}/quiz-media`, { form: fileForm("Apple.PNG", "image/png", PNG) });
  assert.equal(upload.status, 201);
  assert.equal(upload.body.media.kind, "image");
  assert.equal(upload.body.media.mimeType, "image/png");
  assert.equal(upload.body.media.originalName, "Apple.PNG");
  assert.match(upload.body.media.storedName, new RegExp(`^${courseId}-[0-9a-f-]{36}\\.png$`));
  assert.ok(fileExists(upload.body.media.storedName));

  const audio = await call("POST", `/api/tutor/courses/${courseId}/quiz-media`, { form: fileForm("hello.mp3", "audio/mpeg", Buffer.from("ID3-fake")) });
  assert.equal(audio.status, 201);
  assert.equal(audio.body.media.kind, "audio");
});

test("unsupported, oversized or foreign uploads are rejected", async () => {
  for (const [name, type] of [["evil.svg", "image/svg+xml"], ["page.html", "text/html"], ["run.exe", "application/octet-stream"], ["fake.png", "text/html"]]) {
    const response = await call("POST", `/api/tutor/courses/${courseId}/quiz-media`, { form: fileForm(name, type, Buffer.from("x")) });
    assert.equal(response.status, 400, name);
  }
  const big = await call("POST", `/api/tutor/courses/${courseId}/quiz-media`, { form: fileForm("big.png", "image/png", Buffer.alloc(5 * 1024 * 1024 + 10)) });
  assert.equal(big.status, 413);

  const missing = await call("POST", `/api/tutor/courses/${courseId}/quiz-media`, { form: new FormData() });
  assert.equal(missing.status, 400);

  currentUser = { _id: otherTutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  const foreign = await call("POST", `/api/tutor/courses/${courseId}/quiz-media`, { form: fileForm("a.png", "image/png", PNG) });
  assert.equal(foreign.status, 404, "only the course owner can upload");
});

test("a quiz question keeps its attachment, and the server decides the file type", async () => {
  const storedName = placeFile();
  const response = await call("PATCH", `/api/tutor/courses/${courseId}/lessons/${lessonId}`, {
    body: { quiz: { title: "Pictures", questions: [question({ storedName, originalName: "apple.png", mimeType: "text/html", size: 1 })] } },
  });
  assert.equal(response.status, 200);
  const saved = course.lessons[0].quiz.questions[0].media;
  assert.equal(saved.storedName, storedName);
  assert.equal(saved.mimeType, "image/png", "client-supplied mimeType is ignored");
  assert.equal(saved.size, PNG.length, "size is read from the file on disk");
  assert.equal(saved.kind, "image");
  assert.equal(response.body.lessons[0].quiz.questions[0].media.storedName, storedName, "tutor still gets the attachment back");
});

test("attachments from another course or missing files are rejected", async () => {
  const foreign = placeFile("507f1f77bcf86cd799439999");
  const cases = [
    { storedName: foreign },
    { storedName: `${courseId}-00000000-0000-4000-8000-000000000000.png` },
    { storedName: "../../etc/passwd" },
    { storedName: `${courseId}-11111111-1111-4111-8111-111111111111.svg` },
    "not-an-object",
  ];
  for (const media of cases) {
    const response = await call("PATCH", `/api/tutor/courses/${courseId}/lessons/${lessonId}`, { body: { quiz: { title: "T", questions: [question(media)] } } });
    assert.equal(response.status, 400, JSON.stringify(media));
  }
  assert.equal(course.lessons[0].quiz, null);
});

test("enrolled students can load a question attachment, others cannot", async () => {
  const storedName = placeFile();
  course.lessons[0].quiz = { _id: "quiz1", title: "T", questions: [{ _id: "q1", ...question({ storedName, originalName: "a.png", mimeType: "image/png", size: PNG.length, kind: "image" }), options: [{ text: "a" }, { text: "b" }] }, { _id: "q2", question: "No file", type: "true_false", options: [{ text: "True" }, { text: "False" }], correctOption: 0 }] };
  currentUser = { _id: studentId, role: "student", tokenVersion: 0, accountStatus: "approved" };
  const url = "/api/quizzes/chinese/lessons/0/questions";

  const ok = await call("GET", `${url}/q1/media`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/png");
  assert.deepEqual(ok.buffer, PNG);

  assert.equal((await call("GET", `${url}/q2/media`)).status, 404, "question without an attachment");
  assert.equal((await call("GET", `${url}/nope/media`)).status, 404);
  assert.equal((await call("GET", `${url}/q1/media`, { authorization: null })).status, 401);

  enrolled = false;
  assert.equal((await call("GET", `${url}/q1/media`)).status, 403, "not enrolled");
});

test("the course owner can preview an attachment; other tutors cannot", async () => {
  const storedName = placeFile();
  const preview = await call("GET", `/api/tutor/courses/${courseId}/quiz-media/${storedName}`);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/png");
  assert.deepEqual(preview.buffer, PNG);

  assert.equal((await call("GET", `/api/tutor/courses/${courseId}/quiz-media/${placeFile("507f1f77bcf86cd799439999")}`)).status, 404, "name from another course");
  currentUser = { _id: otherTutorId, role: "tutor", tokenVersion: 0, accountStatus: "approved" };
  assert.equal((await call("GET", `/api/tutor/courses/${courseId}/quiz-media/${storedName}`)).status, 404);
});

test("unused attachments are cleaned up, used ones are kept", async () => {
  const kept = placeFile();
  const dropped = placeFile();
  const pending = placeFile();
  const quizWith = (...names) => ({ title: "T", questions: names.map((storedName) => question({ storedName, originalName: "x.png" })) });
  const patch = (quiz) => call("PATCH", `/api/tutor/courses/${courseId}/lessons/${lessonId}`, { body: { quiz } });

  assert.equal((await patch(quizWith(kept, dropped))).status, 200);
  assert.equal((await patch(quizWith(kept))).status, 200);
  await waitForUnlink();
  assert.ok(fileExists(kept));
  assert.equal(fileExists(dropped), false, "removed from the quiz, removed from disk");

  // DELETE only removes files that no saved quiz uses.
  assert.equal((await call("DELETE", `/api/tutor/courses/${courseId}/quiz-media/${kept}`)).status, 204);
  assert.equal((await call("DELETE", `/api/tutor/courses/${courseId}/quiz-media/${pending}`)).status, 204);
  await waitForUnlink();
  assert.ok(fileExists(kept), "still used by the saved quiz");
  assert.equal(fileExists(pending), false, "never saved, so deleted");

  // Deleting the whole quiz removes its attachments too.
  assert.equal((await patch(null)).status, 200);
  await waitForUnlink();
  assert.equal(fileExists(kept), false);
});

test("attachments are created together with a new lesson", async () => {
  const storedName = placeFile();
  const form = new FormData();
  form.append("title", "New lesson");
  form.append("videoUrl", "https://example.com/video.mp4");
  form.append("quiz", JSON.stringify({ title: "T", questions: [question({ storedName, originalName: "a.png" })] }));
  const response = await call("POST", `/api/tutor/courses/${courseId}/lessons`, { form });
  assert.equal(response.status, 201);
  assert.equal(course.lessons.at(-1).quiz.questions[0].media.storedName, storedName);
});

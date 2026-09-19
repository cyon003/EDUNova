const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "lesson-watch-test-secret-at-least-32-characters";

const app = require("../app");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const LessonWatch = require("../models/LessonWatch");
const LearningSignal = require("../models/LearningSignal");
const User = require("../models/User");
const { advanceWatch, canCompleteWatchedMedia } = require("../services/lessonWatchService");

const ids = {
  student: "507f1f77bcf86cd799439081",
  other: "507f1f77bcf86cd799439082",
  tutor: "507f1f77bcf86cd799439083",
  course: "507f1f77bcf86cd799439084",
  lesson: "507f1f77bcf86cd799439085",
};
const course = { _id: ids.course, slug: "watch-course", lessons: [{ _id: ids.lesson, title: "Video", duration: "1:00", primaryMedia: { storedName: "video.mp4", mimeType: "video/mp4" } }] };
const token = (id, role = "student") => jwt.sign({ id, role, tokenVersion: 0 }, process.env.JWT_SECRET);
const originals = {};
const watches = new Map();
let enrollments = new Map();
let server;

function request(method, path, body, auth) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const headers = payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {};
    if (auth) headers.Authorization = `Bearer ${auth}`;
    const call = http.request({ hostname: "127.0.0.1", port: server.address().port, method, path, headers }, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: data ? JSON.parse(data) : null }));
    });
    call.on("error", reject);
    if (payload) call.write(payload);
    call.end();
  });
}

test.before(async () => {
  originals.userFind = User.findById;
  originals.courseFind = Course.findOne;
  originals.enrollmentExists = Enrollment.exists;
  originals.enrollmentFind = Enrollment.findOne;
  originals.enrollmentUpdate = Enrollment.findOneAndUpdate;
  originals.watchFind = LessonWatch.findOne;
  originals.watchUpdate = LessonWatch.findOneAndUpdate;
  originals.watchUpdateOne = LessonWatch.updateOne;
  originals.signalBulk = LearningSignal.bulkWrite;
  User.findById = (id) => ({ select: async () => ({ _id: id, role: id === ids.tutor ? "tutor" : "student", tokenVersion: 0, accountStatus: "approved" }) });
  Course.findOne = async ({ slug }) => slug === course.slug ? course : null;
  Enrollment.exists = async ({ student }) => enrollments.has(student);
  Enrollment.findOne = ({ student }) => ({ populate: async () => enrollments.get(student) || null });
  Enrollment.findOneAndUpdate = ({ student, completedLessons }, update) => ({ populate: async () => {
    const enrollment = enrollments.get(student);
    if (!enrollment || enrollment.completedLessons.includes(completedLessons?.$ne)) return null;
    enrollment.completedLessons.push(update.$addToSet.completedLessons);
    enrollment.completedLessonDates["0"] = update.$set["completedLessonDates.0"];
    enrollment.recentActivity.push(...update.$push.recentActivity.$each);
    return enrollment;
  } });
  LessonWatch.findOne = async ({ student }) => watches.get(student) || null;
  LessonWatch.findOneAndUpdate = async (filter, update) => {
    const existing = watches.get(filter.student);
    if (existing && existing.revision !== filter.revision) return null;
    const next = { ...existing, ...update.$set, student: filter.student, course: filter.course, lesson: filter.lesson, revision: (existing?.revision || 0) + 1 };
    watches.set(filter.student, next);
    return next;
  };
  LessonWatch.updateOne = async ({ student }, update) => {
    const record = watches.get(student);
    if (record) record.completionRecordedAt = update.$set.completionRecordedAt;
    return { modifiedCount: record ? 1 : 0 };
  };
  LearningSignal.bulkWrite = async () => ({});
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originals.userFind;
  Course.findOne = originals.courseFind;
  Enrollment.exists = originals.enrollmentExists;
  Enrollment.findOne = originals.enrollmentFind;
  Enrollment.findOneAndUpdate = originals.enrollmentUpdate;
  LessonWatch.findOne = originals.watchFind;
  LessonWatch.findOneAndUpdate = originals.watchUpdate;
  LessonWatch.updateOne = originals.watchUpdateOne;
  LearningSignal.bulkWrite = originals.signalBulk;
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => {
  watches.clear();
  enrollments = new Map([[ids.student, { student: ids.student, course, completedLessons: [], completedLessonDates: {}, recentActivity: [] }]]);
});

test("watch progression allows rewind but rejects jumping ahead", () => {
  const start = new Date("2026-09-17T00:00:00.000Z");
  const first = advanceWatch(null, { event: "play", position: 0, duration: 60 }, start, "video.mp4", "1:00");
  const watched = advanceWatch(first, { event: "heartbeat", position: 5, duration: 60 }, new Date(start.getTime() + 5000), "video.mp4", "1:00");
  assert.equal(watched.furthestWatchedPosition, 5);
  assert.match(advanceWatch(watched, { event: "seek", position: 40, duration: 60 }, new Date(start.getTime() + 6000), "video.mp4", "1:00").error, /Cannot seek/);
  const rewind = advanceWatch(watched, { event: "seek", position: 2, duration: 60 }, new Date(start.getTime() + 6000), "video.mp4", "1:00");
  assert.equal(rewind.lastPosition, 2);
  assert.equal(rewind.furthestWatchedPosition, 5);
  assert.equal(advanceWatch(rewind, { event: "seek", position: 4, duration: 60 }, new Date(start.getTime() + 7000), "video.mp4", "1:00").lastPosition, 4);
  assert.match(advanceWatch(rewind, { event: "heartbeat", position: 55, duration: 60 }, new Date(start.getTime() + 7000), "video.mp4", "1:00").error, /Cannot skip/);
  assert.match(advanceWatch(first, { event: "heartbeat", position: 60, duration: 60 }, new Date(start.getTime() + 1000), "video.mp4", "1:00").error, /Cannot skip/);
  assert.match(advanceWatch(first, { event: "heartbeat", position: 4, duration: 5 }, new Date(start.getTime() + 1000), "video.mp4", "1:00").error, /duration/i);
  assert.match(advanceWatch(first, { event: "play", position: 0.5, duration: 60 }, start, "video.mp4", "1:00").error, /Cannot seek/);
  assert.match(advanceWatch(watched, { event: "heartbeat", position: 11, duration: 60 }, new Date(start.getTime() + 5000), "video.mp4", "1:00").error, /Cannot skip/);
  assert.equal(canCompleteWatchedMedia(watched, "video.mp4", "1:00"), false);
});

test("completion threshold is 95% of the tutor-confirmed duration", () => {
  const watch = { mediaKey: "video.mp4", videoDuration: 60, furthestWatchedPosition: 56.9, observedPlaybackSeconds: 56.9 };
  assert.equal(canCompleteWatchedMedia(watch, "video.mp4", "1:00"), false);
  assert.equal(canCompleteWatchedMedia({ ...watch, furthestWatchedPosition: 57, observedPlaybackSeconds: 56 }, "video.mp4", "1:00"), false);
  assert.equal(canCompleteWatchedMedia({ ...watch, furthestWatchedPosition: 57, observedPlaybackSeconds: 57 }, "video.mp4", "1:00"), true);
  assert.equal(canCompleteWatchedMedia({ ...watch, furthestWatchedPosition: 57, observedPlaybackSeconds: 57 }, "video.mp4", "Provider managed"), false);
  const shortVideo = { ...watch, videoDuration: 1.1, furthestWatchedPosition: 1.05, observedPlaybackSeconds: 1.05 };
  assert.equal(canCompleteWatchedMedia(shortVideo, "video.mp4", "0:02"), true);
});

test("watch API is authenticated, enrollment-scoped, and rejects forged identity and skips", async () => {
  const path = "/api/enrollments/watch-course/lessons/0/watch";
  assert.equal((await request("GET", path)).status, 401);
  assert.equal((await request("GET", path, undefined, token(ids.tutor, "tutor"))).status, 403);
  assert.equal((await request("GET", path, undefined, token(ids.other))).status, 404);
  const mine = token(ids.student);
  assert.equal((await request("GET", path, undefined, mine)).body.furthestWatchedPosition, 0);
  assert.equal((await request("PATCH", path, { event: "play", position: 0, duration: 60, studentId: ids.other }, mine)).status, 400);
  assert.equal((await request("PATCH", path, { event: "play", position: 40, duration: 60 }, mine)).status, 409);
  assert.equal((await request("PATCH", path, { event: "play", position: 0, duration: 60 }, mine)).status, 200);
  assert.equal((await request("PATCH", path, { event: "seek", position: 40, duration: 60 }, mine)).status, 409);
  assert.equal((await request("POST", "/api/enrollments/watch-course/lessons/0/complete", undefined, mine)).status, 409);
  assert.equal((await request("PATCH", "/api/enrollments/watch-course/progress", { videoPosition: { lessonIndex: 0, seconds: 60 } }, mine)).status, 400);
  enrollments.set(ids.other, { student: ids.other, course, completedLessons: [], completedLessonDates: {}, recentActivity: [] });
  assert.equal((await request("GET", path, undefined, token(ids.other))).body.furthestWatchedPosition, 0);
  assert.equal(watches.size, 1);
});

test("periodic authorized playback restores position and permits completion only after full watch", async () => {
  const start = new Date("2026-09-17T00:00:00.000Z");
  let state = advanceWatch(null, { event: "play", position: 0, duration: 60 }, start, "video.mp4", "1:00");
  for (let position = 5; position <= 60; position += 5) {
    state = advanceWatch(state, { event: position === 60 ? "ended" : "heartbeat", position, duration: 60 }, new Date(start.getTime() + position * 1000), "video.mp4", "1:00");
    assert.equal(state.error, undefined);
  }
  assert.equal(state.furthestWatchedPosition, 60);
  assert.equal(canCompleteWatchedMedia(state, "video.mp4", "1:00"), true);
  assert.equal(canCompleteWatchedMedia(state, "other-video.mp4", "1:00"), false);
  assert.equal(canCompleteWatchedMedia(state, "video.mp4", "Provider managed"), false);
  watches.set(ids.student, { ...state, student: ids.student });
  const mine = token(ids.student);
  const path = "/api/enrollments/watch-course/lessons/0/watch";
  const restored = await request("GET", path, undefined, mine);
  assert.equal(restored.body.lastPosition, 60);
  assert.equal((await request("POST", "/api/enrollments/watch-course/lessons/0/complete", undefined, mine)).status, 200);
  enrollments.set(ids.other, { student: ids.other, course, completedLessons: [], completedLessonDates: {}, recentActivity: [] });
  assert.equal((await request("POST", "/api/enrollments/watch-course/lessons/0/complete", undefined, token(ids.other))).status, 409);
});

test("95% valid playback completes once and updates course progress without a manual request", async () => {
  const start = Date.now() - 57000;
  let state = advanceWatch(null, { event: "play", position: 0, duration: 60 }, new Date(start), "video.mp4", "1:00");
  for (let position = 5; position <= 55; position += 5) {
    state = advanceWatch(state, { event: "heartbeat", position, duration: 60 }, new Date(start + position * 1000), "video.mp4", "1:00");
  }
  assert.equal(canCompleteWatchedMedia(state, "video.mp4", "1:00"), false);
  watches.set(ids.student, { ...state, student: ids.student, revision: 1 });
  const auth = token(ids.student);
  const completionPath = "/api/enrollments/watch-course/lessons/0/complete";
  const watchPath = "/api/enrollments/watch-course/lessons/0/watch";
  assert.equal((await request("POST", completionPath, undefined, auth)).status, 409);
  const update = await request("PATCH", watchPath, { event: "heartbeat", position: 57, duration: 60 }, auth);
  assert.equal(update.status, 200, JSON.stringify(update.body));
  assert.equal(update.body.enrollment.completedLessonCount, 1);
  assert.equal(update.body.enrollment.completionPercentage, 100);
  assert.equal(enrollments.get(ids.student).recentActivity.length, 1);
  const completedAt = enrollments.get(ids.student).completedLessonDates["0"];
  const repeated = await request("PATCH", watchPath, { event: "heartbeat", position: 57, duration: 60 }, auth);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.enrollment, undefined);
  assert.equal((await request("POST", completionPath, undefined, auth)).status, 200);
  assert.equal(enrollments.get(ids.student).completedLessonDates["0"], completedAt);
  assert.equal(enrollments.get(ids.student).recentActivity.length, 1);
});

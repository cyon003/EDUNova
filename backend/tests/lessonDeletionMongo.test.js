const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");

// Never loads .env: all database and file mutations are disposable test fixtures.
test("lesson deletion integrity on a disposable replica set", { skip: process.env.RUN_LESSON_DELETION_MONGO_TESTS !== "true" }, async (t) => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "lesson-deletion-test-only-secret-at-least-32-characters";
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "edunova-deletion-test-"));
  process.env.UPLOAD_ROOT = path.join(temp, "uploads");
  const mongoose = require("mongoose");
  const jwt = require("jsonwebtoken");
  const Course = require("../models/Course");
  const User = require("../models/User");
  const Enrollment = require("../models/Enrollment");
  const Note = require("../models/Note");
  const LessonWatch = require("../models/LessonWatch");
  const LearningSignal = require("../models/LearningSignal");
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const mongo = spawn("mongod", ["--dbpath", temp, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "deletionTest", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  mongo.stderr.resume();
  let server;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Test MongoDB startup timed out")), 20000);
      mongo.once("error", error => { clearTimeout(timer); reject(error); });
      mongo.once("exit", code => { clearTimeout(timer); reject(new Error(`Test MongoDB exited ${code}`)); });
      mongo.stdout.on("data", chunk => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    });
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
      await bootstrap.connect();
      await bootstrap.db().admin().command({ replSetInitiate: { _id: "deletionTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      for (let i = 0; !(await bootstrap.db().admin().command({ hello: 1 })).isWritablePrimary; i++) {
        if (i > 100) throw new Error("Replica set did not elect a primary");
        await delay(100);
      }
    } finally { await bootstrap.close(); }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/deletion_test?replicaSet=deletionTest`);
    await Promise.all([Course, User, Enrollment, Note, LessonWatch, LearningSignal].map(model => model.init()));
    server = require("../app").listen(0, "127.0.0.1");
    await once(server, "listening");
    const tutor = await User.create({ name: "Tutor", email: "tutor@deletion.test", password: "unused", role: "tutor" });
    const student = await User.create({ name: "Student", email: "student@deletion.test", password: "unused" });
    const secondStudent = await User.create({ name: "Student two", email: "second@deletion.test", password: "unused" });
    const request = async (course, index, suffix = "", user = tutor) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tutor/courses/${course.id}/lessons/${course.lessons[index].id}${suffix}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` },
      });
      return { status: response.status, body: await response.json() };
    };
    let serial = 0;
    const dates = [0, 1, 2, 3].map(i => new Date(`2026-09-${10 + i}T12:00:00.000Z`));
    async function fixture() {
      const name = `deletion-${++serial}`;
      const course = await Course.create({ slug: name, name, tutor: tutor._id, description: "Test", level: "Beginner", duration: "4:00", rating: 0, moderationStatus: "published", lessons: ["A", "B", "C", "D"].map((title, i) => ({
        title, duration: "1:00", primaryMedia: { originalName: `${title}.mp4`, storedName: `${name}-${i}.mp4`, mimeType: "video/mp4", storage: "course-videos", size: 5 },
        resources: [{ originalName: `${title}.pdf`, storedName: `${name}-${i}.pdf`, mimeType: "application/pdf", size: 5, url: `/uploads/lesson-resources/${name}-${i}.pdf` }],
      })) });
      for (const lesson of course.lessons) {
        await fs.writeFile(path.join(process.env.UPLOAD_ROOT, "course-videos", lesson.primaryMedia.storedName), `video ${lesson.title}`);
        await fs.writeFile(path.join(process.env.UPLOAD_ROOT, "lesson-resources", lesson.resources[0].storedName), `document ${lesson.title}`);
      }
      const enrollment = await Enrollment.create({ student: student._id, course: course._id, completedLessons: [0, 2, 3], completedLessonDates: { 0: dates[0], 2: dates[2], 3: dates[3] }, currentLessonIndex: 2, videoPositions: { 0: 10, 1: 20, 2: 30, 3: 40 }, studySeconds: 123, studyDates: ["2026-09-10"], completedMissions: ["foundation"], recentActivity: course.lessons.map((lesson, i) => ({ activityType: "lesson_opened", lessonIndex: i, lessonTitle: lesson.title, createdAt: dates[i] })) });
      await Enrollment.create({ student: secondStudent._id, course: course._id, completedLessons: [1], videoPositions: { 1: 15 }, currentLessonIndex: 1 });
      const notes = await Note.create(course.lessons.map((lesson, i) => ({ student: student._id, course: course._id, lessonIndex: i, lessonTitle: lesson.title, title: `Note ${lesson.title}`, body: `Keep ${lesson.title}` })));
      const watches = await LessonWatch.create(course.lessons.map((lesson, i) => ({ student: student._id, course: course._id, lesson: lesson._id, mediaKey: lesson.primaryMedia.storedName, lastPosition: 10 * (i + 1), furthestWatchedPosition: 50, videoDuration: 60 })));
      await LearningSignal.create({ student: student._id, course: course._id, lessonId: course.lessons[0]._id });
      return { course, enrollment, notes, watches };
    }
    const readEnrollment = id => Enrollment.findById(id).lean();
    const file = (course, index, kind) => path.join(process.env.UPLOAD_ROOT, kind === "video" ? "course-videos" : "lesson-resources", kind === "video" ? course.lessons[index].primaryMedia.storedName : course.lessons[index].resources[0].storedName);
    async function manifests(course) {
      const root = path.join(process.env.UPLOAD_ROOT, "media-recovery");
      const values = await Promise.all((await fs.readdir(root)).map(async name => {
        const directory = path.join(root, name);
        return { directory, ...JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8")) };
      }));
      return values.filter(value => value.courseId === course.id);
    }

    for (const removed of [0, 1]) {
      await t.test(`deleting ${removed === 0 ? "first" : "middle"} lesson keeps progress and playback attached to surviving lessons`, async () => {
        const { course, enrollment, notes, watches } = await fixture();
        const result = await request(course, removed);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        const saved = await readEnrollment(enrollment.id);
        assert.deepEqual(saved.completedLessons, removed === 0 ? [1, 2] : [0, 1, 2]);
        assert.deepEqual(saved.completedLessonDates, removed === 0 ? { 1: dates[2], 2: dates[3] } : { 0: dates[0], 1: dates[2], 2: dates[3] });
        assert.deepEqual(saved.videoPositions, removed === 0 ? { 0: 20, 1: 30, 2: 40 } : { 0: 10, 1: 30, 2: 40 });
        assert.equal(saved.currentLessonIndex, 1);
        assert.equal(saved.studySeconds, 123);
        assert.deepEqual(saved.studyDates, ["2026-09-10"]);
        assert.deepEqual(saved.completedMissions, ["foundation"]);
        assert.deepEqual(saved.recentActivity.map(a => [a.lessonIndex, a.lessonTitle]), removed === 0 ? [[0, "B"], [1, "C"], [2, "D"]] : [[0, "A"], [1, "C"], [2, "D"]]);
        const other = await Enrollment.findOne({ student: secondStudent._id, course: course._id }).lean();
        assert.deepEqual(other.completedLessons, removed === 0 ? [0] : []);
        assert.deepEqual(other.videoPositions, removed === 0 ? { 0: 15 } : {});
        assert.equal(other.currentLessonIndex, removed === 0 ? 0 : 1);
        assert.equal((await Note.findById(notes[removed].id)).lessonIndex, null);
        assert.equal((await Note.findById(notes[removed].id)).body, `Keep ${course.lessons[removed].title}`);
        assert.equal((await Note.findById(notes[3].id)).lessonIndex, 2);
        // Stable-ID watch records and assessment history are not rewritten or erased.
        assert.deepEqual(await LessonWatch.findById(watches[3].id).lean(), watches[3].toObject());
        assert.deepEqual((await Course.findById(course.id)).lessons.map(l => l.title), removed === 0 ? ["B", "C", "D"] : ["A", "C", "D"]);
        assert.equal(await LearningSignal.countDocuments({ course: course._id }), removed === 0 ? 0 : 1);
        const [archive] = await manifests(course);
        assert.equal(archive.state, "archived");
        assert.equal(archive.lesson.title, course.lessons[removed].title);
        assert.equal(archive.enrollments.length, 2);
        await assert.rejects(fs.access(file(course, removed, "video")), { code: "ENOENT" });
        for (const item of archive.files) assert.ok((await fs.readFile(path.join(archive.directory, item.backupName))).length);
      });
    }
    await t.test("failed lesson save leaves original media and enrollment data intact", async () => {
      const { course, enrollment } = await fixture();
      const before = await readEnrollment(enrollment.id);
      const original = Course.prototype.save;
      Course.prototype.save = async () => { throw new Error("injected save failure"); };
      let result;
      try { result = await request(course, 0); } finally { Course.prototype.save = original; }
      assert.equal(result.status, 500);
      assert.deepEqual(await readEnrollment(enrollment.id), before);
      assert.equal((await Course.findById(course.id)).lessons.length, 4);
      assert.equal(await fs.readFile(file(course, 0, "video"), "utf8"), "video A");
      assert.equal(await fs.readFile(file(course, 0, "document"), "utf8"), "document A");
    });
    await t.test("failed resource save leaves its file and saved reference intact", async () => {
      const { course } = await fixture();
      const original = Course.prototype.save;
      Course.prototype.save = async () => { throw new Error("injected resource save failure"); };
      let result;
      try { result = await request(course, 1, `/resources/${course.lessons[1].resources[0].id}`); } finally { Course.prototype.save = original; }
      assert.equal(result.status, 500);
      assert.equal((await Course.findById(course.id)).lessons[1].resources.length, 1);
      assert.equal(await fs.readFile(file(course, 1, "document"), "utf8"), "document B");
    });
    await t.test("failure after progress writes rolls back the course, all enrollments and notes", async () => {
      const { course } = await fixture();
      const beforeCourse = await Course.findById(course.id).lean();
      const beforeEnrollments = await Enrollment.find({ course: course._id }).lean();
      const beforeNotes = await Note.find({ course: course._id }).lean();
      const original = LearningSignal.deleteMany;
      LearningSignal.deleteMany = async () => { throw new Error("injected final database write failure"); };
      let result;
      try { result = await request(course, 0); } finally { LearningSignal.deleteMany = original; }
      assert.equal(result.status, 500);
      assert.deepEqual(await Course.findById(course.id).lean(), beforeCourse);
      assert.deepEqual(await Enrollment.find({ course: course._id }).lean(), beforeEnrollments);
      assert.deepEqual(await Note.find({ course: course._id }).lean(), beforeNotes);
      assert.equal(await fs.readFile(file(course, 0, "video"), "utf8"), "video A");
      assert.equal((await manifests(course))[0].state, "prepared");
      assert.equal((await request(course, 0)).status, 200);
    });
    await t.test("main-media removal preserves saved media on failure and archives it on success", async () => {
      const { course } = await fixture();
      const original = Course.prototype.save;
      Course.prototype.save = async () => { throw new Error("injected main-media save failure"); };
      let result;
      try { result = await request(course, 0, "/main-media"); } finally { Course.prototype.save = original; }
      assert.equal(result.status, 500);
      assert.equal(await fs.readFile(file(course, 0, "video"), "utf8"), "video A");
      assert.equal((await Course.findById(course.id)).lessons[0].primaryMedia.storedName, course.lessons[0].primaryMedia.storedName);
      assert.equal((await request(course, 0, "/main-media")).status, 200);
      await assert.rejects(fs.access(file(course, 0, "video")), { code: "ENOENT" });
      assert.equal(await fs.readFile(file(course, 0, "document"), "utf8"), "document A");
      assert.ok((await manifests(course)).some(item => item.state === "archived"));
    });
    await t.test("repeated deletion is safe and deleting the final remaining lesson clears active indexes", async () => {
      const { course, enrollment } = await fixture();
      for (const index of [3, 2, 1, 0]) assert.equal((await request(course, index)).status, 200);
      assert.equal((await request(course, 0)).status, 404);
      const saved = await readEnrollment(enrollment.id);
      assert.deepEqual(saved.completedLessons, []);
      assert.deepEqual(saved.videoPositions, {});
      assert.deepEqual(saved.completedLessonDates, {});
      assert.equal(saved.currentLessonIndex, 0);
      assert.equal(await Note.countDocuments({ course: course._id }), 4);
    });
    await t.test("media backup failure prevents deletion without modifying database or live files", async () => {
      const { course, enrollment } = await fixture();
      const before = await readEnrollment(enrollment.id);
      const original = fs.link;
      fs.link = async () => { throw Object.assign(new Error("injected disk failure"), { code: "ENOSPC" }); };
      let result;
      try { result = await request(course, 0); } finally { fs.link = original; }
      assert.equal(result.status, 500);
      assert.deepEqual(await readEnrollment(enrollment.id), before);
      assert.equal((await Course.findById(course.id)).lessons.length, 4);
      assert.equal(await fs.readFile(file(course, 0, "video"), "utf8"), "video A");
    });
    await t.test("cleanup failure after commit preserves recoverable bytes and reports successful deletion", async () => {
      const { course } = await fixture();
      const original = fs.unlink;
      fs.unlink = async () => { throw Object.assign(new Error("injected unlink failure"), { code: "EACCES" }); };
      let result;
      try { result = await request(course, 0); } finally { fs.unlink = original; }
      assert.equal(result.status, 200);
      assert.equal((await Course.findById(course.id)).lessons.length, 3);
      assert.equal(await fs.readFile(file(course, 0, "video"), "utf8"), "video A");
      const [archive] = await manifests(course);
      assert.equal(archive.state, "committed");
      assert.equal(await fs.readFile(path.join(archive.directory, archive.files[0].backupName), "utf8"), "video A");
    });
    await t.test("students and non-owning tutors cannot delete lessons", async () => {
      const { course } = await fixture();
      assert.equal((await request(course, 0, "", student)).status, 403);
      const otherTutor = await User.create({ name: "Other", email: "other@deletion.test", password: "unused", role: "tutor" });
      assert.equal((await request(course, 0, "", otherTutor)).status, 404);
      assert.equal((await Course.findById(course.id)).lessons.length, 4);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo.exitCode === null) { const exited = once(mongo, "exit"); mongo.kill("SIGTERM"); await exited; }
    await fs.rm(temp, { recursive: true, force: true });
  }
});

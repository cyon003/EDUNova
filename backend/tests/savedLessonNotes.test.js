const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const Note = require("../models/Note");
const Enrollment = require("../models/Enrollment");
const router = require("../routes/noteRoutes");
const save = router.stack.find(layer => layer.route?.path === "/" && layer.route.methods.post).route.stack[0].handle;

test("summary saves use stored text, retain course identity and deduplicate per student", async t => {
  const notes = [];
  let enrolled = true;
  const course = { _id: "course", __v: 2, lessons: [{ title: "Gravity", summary: "Tutor summary" }] };
  t.mock.method(mongoose.connection, "transaction", async work => work());
  t.mock.method(Course, "findOne", async () => course);
  t.mock.method(Course, "updateOne", async () => ({}));
  t.mock.method(Enrollment, "exists", async () => enrolled);
  t.mock.method(Note, "findOne", async filter => notes.find(note => Object.keys(filter).every(key => note[key] === filter[key])));
  t.mock.method(Note, "create", async values => { const note = { ...values, _id: String(notes.length), populate: async () => {} }; notes.push(note); return note; });
  const request = async (student, extra = {}) => {
    const req = { user: { _id: student }, get: () => "2", body: { sourceType: "saved_from_summary", courseSlug: "science", lessonIndex: 0, title: "Forged title", body: "Forged summary", ...extra } };
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await save(req, res); return res;
  };
  const first = await request("one");
  assert.equal(first.statusCode, 201);
  assert.equal(first.body.body, "Tutor summary"); assert.equal(first.body.lessonTitle, "Gravity");
  assert.equal(first.body.course, "course"); assert.equal(first.body.sourceType, "saved_from_summary");
  await request("one"); assert.equal(notes.length, 1);
  await request("two"); assert.equal(notes.length, 2);
  enrolled = false; assert.equal((await request("three")).statusCode, 403);
  enrolled = true; assert.equal((await request("one", { lessonIndex: 9 })).statusCode, 400);
  assert.equal((await request("one", { sourceType: "personal", courseSlug: null, lessonIndex: null })).body.sourceType, "personal");
});

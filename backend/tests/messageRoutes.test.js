const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "message-route-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Message = require("../models/Message");
const User = require("../models/User");
const app = require("../app");

const ids = {
  tutor: "507f1f77bcf86cd799439101",
  student: "507f1f77bcf86cd799439102",
  stranger: "507f1f77bcf86cd799439103",
  course: "507f1f77bcf86cd799439104",
  message: "507f1f77bcf86cd799439105",
};

const tutor = { _id: ids.tutor, name: "Tutor", email: "tutor@example.com", role: "tutor", tokenVersion: 0, accountStatus: "approved" };
const student = { _id: ids.student, name: "Student", email: "student@example.com", role: "student", tokenVersion: 0, accountStatus: "approved" };
const course = { _id: ids.course, name: "Secure Messaging", slug: "secure-messaging" };

let currentUser = tutor;
let tutorCourses = [course];
let courseEnrollments = [{ student, course: ids.course }];
let server;
const originals = {};

function authToken(user = currentUser) {
  return jwt.sign({ id: user._id, role: user.role, tokenVersion: 0 }, process.env.JWT_SECRET);
}

function request(method, pathname, body, authenticated = true) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const address = server.address();
    const headers = { "Content-Type": "application/json" };
    if (authenticated) headers.Authorization = `Bearer ${authToken()}`;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
    const outgoing = http.request({ hostname: "127.0.0.1", port: address.port, path: pathname, method, headers }, (response) => {
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

function leanQuery(value) {
  const query = {
    select() { return query; },
    populate() { return query; },
    sort() { return query; },
    limit() { return query; },
    lean: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return query;
}

test.before(async () => {
  originals.userFindById = User.findById;
  originals.courseFind = Course.find;
  originals.enrollmentFind = Enrollment.find;
  originals.messageCreate = Message.create;
  originals.messageCount = Message.countDocuments;
  originals.messageUpdateMany = Message.updateMany;
  originals.messageFind = Message.find;
  originals.messageFindOneAndUpdate = Message.findOneAndUpdate;

  User.findById = () => ({ select: async () => currentUser });
  Course.find = () => leanQuery(tutorCourses);
  Enrollment.find = () => leanQuery(courseEnrollments);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originals.userFindById;
  Course.find = originals.courseFind;
  Enrollment.find = originals.enrollmentFind;
  Message.create = originals.messageCreate;
  Message.countDocuments = originals.messageCount;
  Message.updateMany = originals.messageUpdateMany;
  Message.find = originals.messageFind;
  Message.findOneAndUpdate = originals.messageFindOneAndUpdate;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(() => {
  currentUser = tutor;
  tutorCourses = [course];
  courseEnrollments = [{ student, course: ids.course }];
  Message.countDocuments = async () => 0;
  Message.create = async (record) => ({ _id: ids.message, ...record, read: false });
  Message.updateMany = async () => ({ modifiedCount: 1 });
  Message.find = () => leanQuery([]);
  Message.findOneAndUpdate = async () => null;
});

test("messaging routes require authentication", async () => {
  const response = await request("GET", "/api/messages/unread-count", undefined, false);
  assert.equal(response.status, 401);
});

test("unread count is limited to the authenticated recipient", async () => {
  let capturedFilter;
  Message.countDocuments = async (filter) => { capturedFilter = filter; return 4; };
  const response = await request("GET", "/api/messages/unread-count");
  assert.equal(response.status, 200);
  assert.equal(response.body.count, 4);
  assert.equal(String(capturedFilter.recipient), ids.tutor);
  assert.equal(capturedFilter.read, false);
  assert.equal(capturedFilter.deletedAt, null);
});

test("a tutor can message only a student enrolled in the tutor's course", async () => {
  let created;
  Message.create = async (record) => { created = record; return { _id: ids.message, ...record }; };
  const allowed = await request("POST", "/api/messages", {
    recipientId: ids.student,
    courseId: ids.course,
    content: "  Welcome to the course.  ",
  });
  assert.equal(allowed.status, 201);
  assert.equal(created.content, "Welcome to the course.");
  assert.equal(String(created.course), ids.course);

  tutorCourses = [];
  courseEnrollments = [];
  const blocked = await request("POST", "/api/messages", {
    recipientId: ids.stranger,
    content: "Not permitted",
  });
  assert.equal(blocked.status, 403);
});

test("empty and oversized messages are rejected", async () => {
  assert.equal((await request("POST", "/api/messages", { recipientId: ids.student, content: "   " })).status, 400);
  assert.equal((await request("POST", "/api/messages", { recipientId: ids.student, content: "x".repeat(2001) })).status, 400);
});

test("opening an authorized conversation marks received messages as read", async () => {
  let updateFilter;
  let messageFilter;
  Message.updateMany = async (filter) => { updateFilter = filter; return { modifiedCount: 2 }; };
  Message.find = (filter) => { messageFilter = filter; return leanQuery([]); };
  const response = await request("GET", `/api/messages/${ids.student}`);
  assert.equal(response.status, 200);
  assert.equal(String(updateFilter.sender), ids.student);
  assert.equal(String(updateFilter.recipient), ids.tutor);
  assert.equal(updateFilter.read, false);
  assert.equal(messageFilter.deletedAt, null);
});

test("only a message sender can soft-delete their message", async () => {
  let capturedFilter;
  let capturedUpdate;
  Message.findOneAndUpdate = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: ids.message };
  };
  const deleted = await request("DELETE", `/api/messages/${ids.message}`);
  assert.equal(deleted.status, 200);
  assert.equal(String(capturedFilter.sender), ids.tutor);
  assert.equal(capturedFilter.deletedAt, null);
  assert.equal(String(capturedUpdate.$set.deletedBy), ids.tutor);

  Message.findOneAndUpdate = async () => null;
  const denied = await request("DELETE", `/api/messages/${ids.message}`);
  assert.equal(denied.status, 404);
});

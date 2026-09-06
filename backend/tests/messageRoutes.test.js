const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const { io: createSocketClient } = require("socket.io-client");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "message-route-test-secret-at-least-32-characters";

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Message = require("../models/Message");
const User = require("../models/User");
const app = require("../app");
const { attachMessageSocket } = require("../realtime/messageSocket");

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
let messageIo;
const socketClients = [];
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

function socketEvent(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function connectSocket(user) {
  const address = server.address();
  const socket = createSocketClient(`http://127.0.0.1:${address.port}`, {
    auth: { token: authToken(user) },
    transports: ["websocket"],
    forceNew: true,
  });
  socketClients.push(socket);
  await socketEvent(socket, "connect");
  return socket;
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

  User.findById = (id) => ({
    select: async () => [tutor, student].find((user) => String(user._id) === String(id)) || null,
  });
  Course.find = () => leanQuery(tutorCourses);
  Enrollment.find = () => leanQuery(courseEnrollments);
  server = http.createServer(app);
  messageIo = attachMessageSocket(server, app);
  server.listen(0, "127.0.0.1");
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
  for (const socket of socketClients) socket.disconnect();
  await new Promise((resolve) => messageIo.close(resolve));
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

test("authenticated private rooms receive live message, unread, read and delete updates", async () => {
  const tutorSocket = await connectSocket(tutor);
  const studentSocket = await connectSocket(student);

  let savedBeforeEvent = false;
  Message.create = async (record) => {
    savedBeforeEvent = true;
    return { _id: ids.message, ...record, read: false, createdAt: new Date() };
  };
  Message.countDocuments = async () => 1;

  const newMessageEvent = socketEvent(studentSocket, "message:new");
  const unreadEvent = socketEvent(studentSocket, "unread:update");
  currentUser = tutor;
  const sent = await request("POST", "/api/messages", {
    recipientId: ids.student,
    courseId: ids.course,
    content: "Live hello",
  });
  const [liveMessage, unread] = await Promise.all([newMessageEvent, unreadEvent]);
  assert.equal(sent.status, 201);
  assert.equal(savedBeforeEvent, true);
  assert.equal(liveMessage.content, "Live hello");
  assert.equal(String(liveMessage.sender), ids.tutor);
  assert.equal(unread.count, 1);

  currentUser = student;
  courseEnrollments = [{ course: { ...course, tutor } }];
  Message.countDocuments = async () => 0;
  const readEvent = socketEvent(tutorSocket, "message:read");
  const readUnreadEvent = socketEvent(studentSocket, "unread:update");
  const opened = await request("GET", `/api/messages/${ids.tutor}`);
  const [readUpdate, clearedUnread] = await Promise.all([readEvent, readUnreadEvent]);
  assert.equal(opened.status, 200);
  assert.equal(readUpdate.readerId, ids.student);
  assert.equal(clearedUnread.count, 0);

  currentUser = tutor;
  Message.findOneAndUpdate = async () => ({
    _id: ids.message,
    sender: ids.tutor,
    recipient: ids.student,
  });
  const deletedEvent = socketEvent(studentSocket, "message:deleted");
  const deleted = await request("DELETE", `/api/messages/${ids.message}`);
  const deletion = await deletedEvent;
  assert.equal(deleted.status, 200);
  assert.equal(deletion.messageId, ids.message);
});

test("socket connections reject invalid JWTs", async () => {
  const address = server.address();
  const socket = createSocketClient(`http://127.0.0.1:${address.port}`, {
    auth: { token: "invalid-token" },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  socketClients.push(socket);
  const error = await socketEvent(socket, "connect_error");
  assert.equal(error.message, "Authentication failed");
});

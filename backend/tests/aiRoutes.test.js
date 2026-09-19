const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "phase-one-test-secret-that-is-at-least-32-characters";
process.env.AI_GENERAL_RATE_LIMIT_PER_MINUTE = "100";
process.env.AI_CHATBOT_RECENT_CONTEXT_LIMIT = "3";


const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const originalCourseFind = Course.findById;
const originalEnrollmentFind = Enrollment.findOne;
const courseId = "507f1f77bcf86cd799439012";
const lessonId = "507f1f77bcf86cd799439013";
const topicId = "507f1f77bcf86cd799439014";
const otherCourseId = "507f1f77bcf86cd799439015";
let course;
const lessonPayload = (changes = {}) => ({ mode: "lesson", message: "Can you explain this more simply?", courseId, lessonId, videoTimestampSeconds: 625, ...changes });
const lessonQuery = (changes = {}) => {
  const { message: _message, ...query } = lessonPayload(changes);
  return new URLSearchParams(query).toString();
};
const lessonDisclaimer = "AI-generated using available lesson context; verify important details with your tutor.";
const User = require("../models/User");
const ChatbotConversation = require("../models/ChatbotConversation");
const subscriptionService = require("../services/subscriptionService");
const originalSubscriptionMethods = { ...subscriptionService };
const geminiService = require("../services/geminiService");
const app = require("../app");

const user = { _id: "507f1f77bcf86cd799439011", role: "student", tokenVersion: 0, accountStatus: "approved" };
const otherUser = "507f191e810c19729de860ea";
const token = jwt.sign({ id: user._id, role: user.role, tokenVersion: 0 }, process.env.JWT_SECRET);
let server;
let originalFetch;
let originalFindById;
let originalFind;
let originalCountDocuments;
let originalDeleteMany;
let originalCreate;

function request(method, path, body, authenticated = true) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const address = server.address();
    const headers = { "Content-Type": "application/json" };
    if (authenticated) headers.Authorization = `Bearer ${token}`;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
    const outgoing = http.request({ hostname: "127.0.0.1", port: address.port, path, method, headers }, (response) => {
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

function conversationFind(records, capturedFilters) {
  return (filter) => {
    capturedFilters?.push(filter);
    const chain = {
      select() { return chain; }, sort() { return chain; }, skip() { return chain; }, limit() { return chain; },
      lean: async () => records,
      then(resolve, reject) { return Promise.resolve(records).then(resolve, reject); },
    };
    return chain;
  };
}

test.before(async () => {
  originalFetch = geminiService.generateAnswer;
  originalFindById = User.findById;
  originalFind = ChatbotConversation.find;
  originalCountDocuments = ChatbotConversation.countDocuments;
  originalDeleteMany = ChatbotConversation.deleteMany;
  originalCreate = ChatbotConversation.create;
  User.findById = () => ({ select: async () => user });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  Course.findById = originalCourseFind; Enrollment.findOne = originalEnrollmentFind;
  Object.assign(subscriptionService, originalSubscriptionMethods);
  geminiService.generateAnswer = originalFetch;
  User.findById = originalFindById;
  ChatbotConversation.find = originalFind;
  ChatbotConversation.countDocuments = originalCountDocuments;
  ChatbotConversation.deleteMany = originalDeleteMany;
  ChatbotConversation.create = originalCreate;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(() => {
  user.role = "student";
  course = new Course({ _id: courseId, name: "Introduction to Python", lessons: [{ _id: lessonId, title: "Loops", description: "Loop fundamentals", summary: "Repeating operations", transcript: "Tutor-owned transcript. Use for loops to iterate over a sequence.", topics: [{ _id: topicId, title: "For Loop", startTimeSeconds: 480, endTimeSeconds: 720 }] }] });
  Course.findById = (id) => ({ select: async () => [courseId, otherCourseId].includes(String(id)) ? (String(id) === otherCourseId ? new Course({ _id: otherCourseId, name: "Private course", lessons: course.lessons }) : course) : null });
  Enrollment.findOne = async (filter) => String(filter.student) === user._id && String(filter.course) === courseId ? { student: user._id, course: courseId } : null;
  subscriptionService.reserveUsage = async () => null;
  subscriptionService.settleUsage = async () => {};
  subscriptionService.getSubscription = async () => ({ plan: "free", aiUsage: { used: 1, limit: 5 } });
  ChatbotConversation.find = conversationFind([]);
  ChatbotConversation.countDocuments = async () => 0;
  ChatbotConversation.deleteMany = async () => ({ deletedCount: 0 });
  ChatbotConversation.create = async (record) => ({ ...record, _id: "conversation-1", createdAt: new Date("2026-08-28T00:00:00Z") });
  geminiService.generateAnswer = async () => ({ mode: "general", answer: "A general answer.", responseType: "generated", disclaimer: "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials." });
});

test("AI routes require authentication", async () => {
  const response = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" }, false);
  assert.equal(response.status, 401);
});

test("general chat sends only general context and stores a general conversation", async () => {
  const filters = [];
  ChatbotConversation.find = conversationFind([{ userMessage: "Earlier", assistantAnswer: "Earlier answer" }], filters);
  let providerPayload;
  let saved;
  ChatbotConversation.create = async (record) => { saved = record; return { ...record, _id: "saved-id" }; };
  geminiService.generateAnswer = async (payload) => {
    providerPayload = payload;
    return { mode: "general", answer: "A general answer.", responseType: "generated", disclaimer: "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials." };
  };
  const response = await request("POST", "/api/ai/chat", { mode: "general", message: "  Explain fractions  " });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(providerPayload).sort(), ["conversation", "message", "mode"]);
  assert.equal(providerPayload.message, "Explain fractions");
  assert.deepEqual(providerPayload.conversation, [{ role: "user", content: "Earlier" }, { role: "assistant", content: "Earlier answer" }]);
  assert.equal(saved.user, user._id);
  assert.equal(saved.assistantAnswer, "A general answer.");
  assert.equal(response.body.conversationId, "saved-id");
  assert.equal(filters[0].user, user._id);
  assert.equal(filters[0].mode, "general");
});

test("course mode and course-specific chat fields are rejected", async () => {
  assert.equal((await request("POST", "/api/ai/chat", { mode: "course", message: "Hello" })).status, 400);
  for (const field of ["courseId", "lessonId", "documents", "sources", "followUp"]) {
    const response = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello", [field]: field.endsWith("s") ? [] : "value" });
    assert.equal(response.status, 400, field);
  }
});

test("course listing endpoint is disabled", async () => {
  assert.equal((await request("GET", "/api/ai/courses")).status, 404);
});

test("history listing is isolated to the authenticated user and general mode", async () => {
  const filters = [];
  ChatbotConversation.find = conversationFind([{ _id: "one", userMessage: "Q", assistantAnswer: "A" }], filters);
  ChatbotConversation.countDocuments = async (filter) => { filters.push(filter); return 1; };
  const response = await request("GET", "/api/ai/history?mode=general");
  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  for (const filter of filters) {
    assert.equal(String(filter.user), user._id);
    assert.equal(filter.mode, "general");
    assert.notEqual(String(filter.user), otherUser);
  }
});

test("history clearing deletes only the authenticated user's general history", async () => {
  let deletedFilter;
  ChatbotConversation.deleteMany = async (filter) => { deletedFilter = filter; return { deletedCount: 2 }; };
  const response = await request("DELETE", "/api/ai/history?mode=general");
  assert.equal(response.status, 200);
  assert.equal(response.body.deletedCount, 2);
  assert.equal(String(deletedFilter.user), user._id);
  assert.deepEqual(deletedFilter, { user: user._id, mode: "general" });
});

test("course history and course-specific history fields are rejected", async () => {
  assert.equal((await request("GET", "/api/ai/history?mode=course&courseId=507f1f77bcf86cd799439012")).status, 400);
  assert.equal((await request("DELETE", "/api/ai/history?mode=general&lessonId=507f1f77bcf86cd799439013")).status, 400);
});

test("provider failures preserve safe responses and release quota", async () => {
  for (const status of [429, 502, 503, 504]) {
    const reservation = { key: "usage", token: "reserved" };
    const settlements = [];
    subscriptionService.reserveUsage = async () => reservation;
    subscriptionService.settleUsage = async (...args) => settlements.push(args);
    geminiService.generateAnswer = async () => { throw Object.assign(new Error("safe"), { status, publicMessage: "Safe provider error" }); };
    const response = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" });
    assert.equal(response.status, status);
    assert.equal(response.body.message, "Safe provider error");
    assert.deepEqual(settlements, [[reservation, false]]);
  }
});

test("lesson chat derives bounded trusted material and stores metadata without transcript", async () => {
  const filters = []; let provider; let saved; const settled = [];
  subscriptionService.reserveUsage = async () => ({ key: "test-reservation" });
  subscriptionService.settleUsage = async (...args) => settled.push(args);
  ChatbotConversation.find = conversationFind([], filters);
  ChatbotConversation.create = async value => { saved = value; return { ...value, _id: "lesson-chat" }; };
  geminiService.generateAnswer = async value => { provider = value; return { mode: "lesson", answer: "Try a for loop.", responseType: "generated", disclaimer: lessonDisclaimer }; };
  const result = await request("POST", "/api/ai/chat", lessonPayload());
  assert.equal(result.status, 200);
  assert.equal(provider.mode, "lesson");
  assert.equal(provider.lessonContext.courseTitle, "Introduction to Python");
  assert.equal(provider.lessonContext.lessonTitle, "Loops");
  assert.equal(provider.lessonContext.topicTitle, "For Loop");
  assert.equal(provider.lessonContext.videoTimestampSeconds, 625);
  assert.match(provider.lessonContext.transcriptExcerpt, /Tutor-owned transcript/);
  assert.match(provider.lessonContext.transcriptAlignment, /no timestamp alignment/);
  assert.deepEqual(result.body.context, { courseTitle: "Introduction to Python", lessonTitle: "Loops", topicTitle: "For Loop", videoTimestampSeconds: 625 });
  assert.doesNotMatch(JSON.stringify(result.body), /Tutor-owned|transcriptExcerpt/);
  assert.equal(String(saved.course), courseId); assert.equal(String(saved.lessonId), lessonId); assert.equal(String(saved.topicId), topicId);
  assert.equal(saved.topicTitle, "For Loop"); assert.equal(saved.videoTimestampSeconds, 625);
  assert.equal(saved.transcript, undefined); assert.equal(saved.lessonContext, undefined);
  assert.equal(filters[0].mode, "lesson"); assert.equal(String(filters[0].topicId), topicId);
  assert.deepEqual(settled, [[{ key: "test-reservation" }, true]]);
});

test("lesson chat rejects invalid IDs, missing fields, timestamps and forged context before generation", async () => {
  let generated = 0, reserved = 0;
  geminiService.generateAnswer = async () => { generated++; };
  subscriptionService.reserveUsage = async () => { reserved++; };
  for (const key of ["courseId", "lessonId", "videoTimestampSeconds"]) {
    const payload = lessonPayload(); delete payload[key];
    assert.equal((await request("POST", "/api/ai/chat", payload)).status, 400, key);
  }
  for (const field of ["courseId", "lessonId"]) for (const value of ["invalid", { $ne: null }, 4]) assert.equal((await request("POST", "/api/ai/chat", lessonPayload({ [field]: value }))).status, 400);
  for (const value of [-1, "625", null, {}, Infinity]) assert.equal((await request("POST", "/api/ai/chat", lessonPayload({ videoTimestampSeconds: value }))).status, 400);
  for (const field of ["studentId", "topicId", "topicTitle", "transcript", "confusionProbability", "maximumVideoProgressPercent", "activeTimeSeconds", "pauseCount", "replayCount", "visitCount", "lessonCompleted", "features"]) {
    assert.equal((await request("POST", "/api/ai/chat", lessonPayload({ [field]: "forged" }))).status, 400, field);
  }
  assert.equal(generated, 0); assert.equal(reserved, 0);
});

test("lesson authorization denies unauthenticated, unenrolled, staff and cross-course access without content leakage", async () => {
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload(), false)).status, 401);
  for (const [changes, status] of [[{ courseId: otherCourseId }, 403], [{ courseId: "507f1f77bcf86cd799439099" }, 404], [{ lessonId: "507f1f77bcf86cd799439099" }, 404]]) {
    const result = await request("POST", "/api/ai/chat", lessonPayload(changes));
    assert.equal(result.status, status); assert.doesNotMatch(JSON.stringify(result.body), /Introduction|Private course|Tutor-owned|For Loop/);
  }
  user.role = "tutor";
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).status, 403);
  // General mode remains available to existing staff roles.
  assert.equal((await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" })).status, 200);
  user.role = "student"; Enrollment.findOne = async () => null;
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).status, 403);
});

test("missing topic/transcript is allowed and large server material is bounded", async () => {
  let material;
  geminiService.generateAnswer = async value => { material = value.lessonContext; return { mode: "lesson", answer: "General explanation.", responseType: "generated", disclaimer: lessonDisclaimer }; };
  course.lessons[0].transcript = "";
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload({ videoTimestampSeconds: 20 }))).status, 200);
  assert.equal(material.topicTitle, null); assert.equal(material.transcriptExcerpt, "");
  course.lessons[0].transcript = "x".repeat(50000); course.lessons[0].description = "d".repeat(5000); course.lessons[0].summary = "s".repeat(5000);
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).status, 200);
  assert.equal(material.transcriptExcerpt.length, 8000); assert.equal(material.transcriptTruncated, true);
  assert.equal(material.description.length, 1000); assert.equal(material.summary.length, 2000);
});

test("lesson history reads, generation context and deletion use the authorized user/course/lesson/topic scope", async () => {
  const filters = [];
  ChatbotConversation.find = conversationFind([], filters);
  ChatbotConversation.countDocuments = async filter => { filters.push(filter); return 0; };
  ChatbotConversation.deleteMany = async filter => { filters.push(filter); return { deletedCount: 0 }; };
  geminiService.generateAnswer = async () => ({ mode: "lesson", answer: "Explanation.", responseType: "generated", disclaimer: lessonDisclaimer });
  const history = await request("GET", `/api/ai/history?${lessonQuery()}`);
  assert.equal(history.status, 200); assert.equal(history.body.context.topicTitle, "For Loop");
  assert.doesNotMatch(JSON.stringify(history.body.context), /transcript|summary|description/);
  assert.equal((await request("DELETE", `/api/ai/history?${lessonQuery()}`)).status, 200);
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).status, 200);
  for (const filter of filters) {
    assert.equal(String(filter.user), user._id); assert.equal(filter.mode, "lesson");
    assert.equal(String(filter.course), courseId); assert.equal(String(filter.lessonId), lessonId); assert.equal(String(filter.topicId), topicId);
  }
  filters.length = 0;
  assert.equal((await request("GET", `/api/ai/history?${lessonQuery({ videoTimestampSeconds: 20 })}`)).status, 200);
  assert.equal(filters[0].topicId, null);
  filters.length = 0;
  for (const method of ["GET", "DELETE"]) {
    assert.equal((await request(method, `/api/ai/history?${lessonQuery({ courseId: otherCourseId })}`)).status, 403);
    assert.equal((await request(method, `/api/ai/history?${lessonQuery({ topicId })}`)).status, 400);
  }
  assert.equal(filters.length, 0);
});

test("general mode rejects newly introduced lesson context fields", async () => {
  for (const field of ["videoTimestampSeconds", "topicId", "topicTitle", "transcript", "studentId", "confusionProbability", "features"]) {
    assert.equal((await request("POST", "/api/ai/chat", { mode: "general", message: "Hello", [field]: "forged" })).status, 400);
    assert.equal((await request("GET", `/api/ai/history?mode=general&${field}=forged`)).status, 400);
  }
});

test("lesson provider and save failures release reservations; quota rejection prevents generation", async () => {
  const settlements = []; const reservation = { key: "lesson-usage" };
  subscriptionService.reserveUsage = async () => reservation;
  subscriptionService.settleUsage = async (...args) => settlements.push(args);
  geminiService.generateAnswer = async () => { throw Object.assign(new Error("hidden-details"), { status: 503, publicMessage: "Temporarily unavailable" }); };
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).status, 503);
  geminiService.generateAnswer = async () => ({ mode: "lesson", answer: "A.", responseType: "generated", disclaimer: lessonDisclaimer });
  ChatbotConversation.create = async () => { throw new Error("private database detail"); };
  const failed = await request("POST", "/api/ai/chat", lessonPayload());
  assert.equal(failed.status, 500); assert.doesNotMatch(JSON.stringify(failed.body), /private database/);
  assert.deepEqual(settlements, [[reservation, false], [reservation, false]]);
  let generated = false;
  subscriptionService.reserveUsage = async () => { throw { quota: { code: "AI_QUOTA_EXCEEDED", plan: "free", limit: 5 } }; };
  geminiService.generateAnswer = async () => { generated = true; };
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).body.code, "AI_QUOTA_EXCEEDED");
  assert.equal(generated, false);
});

test("lesson and general requests share the existing per-user short-term limiter", async () => {
  process.env.AI_GENERAL_RATE_LIMIT_PER_MINUTE = "1";
  try {
    assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).status, 429);
    assert.equal((await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" })).status, 429);
  } finally { process.env.AI_GENERAL_RATE_LIMIT_PER_MINUTE = "100"; }
});

test("conversation schema remains compatible with general records and requires minimal lesson metadata", async () => {
  await new ChatbotConversation({ user: user._id, userMessage: "Q", assistantAnswer: "A" }).validate();
  await assert.rejects(new ChatbotConversation({ user: user._id, mode: "lesson", userMessage: "Q", assistantAnswer: "A" }).validate());
  await new ChatbotConversation({ user: user._id, mode: "lesson", course: courseId, lessonId, videoTimestampSeconds: 0, userMessage: "Q", assistantAnswer: "A" }).validate();
});

test("recent answers never cross student, general, course, lesson or resolved topic boundaries", async () => {
  const matching = { user: user._id, mode: "lesson", course: courseId, lessonId, topicId, answerMode: "generated", userMessage: "Current lesson question", assistantAnswer: "Current lesson answer" };
  const records = [matching,
    { ...matching, user: otherUser, userMessage: "OTHER_STUDENT" },
    { ...matching, course: otherCourseId, userMessage: "OTHER_COURSE" },
    { ...matching, lessonId: otherCourseId, userMessage: "OTHER_LESSON" },
    { ...matching, topicId: null, userMessage: "OTHER_TOPIC" },
    { ...matching, mode: "general", userMessage: "GENERAL_ONLY" },
  ];
  ChatbotConversation.find = filter => conversationFind(records.filter(record => Object.entries(filter).every(([key, value]) => String(record[key]) === String(value))))(filter);
  let received;
  geminiService.generateAnswer = async value => { received = value; return { mode: value.mode, answer: "A.", responseType: "generated", disclaimer: value.mode === "lesson" ? lessonDisclaimer : "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials." }; };
  assert.equal((await request("POST", "/api/ai/chat", lessonPayload())).status, 200);
  assert.deepEqual(received.conversation, [{ role: "user", content: "Current lesson question" }, { role: "assistant", content: "Current lesson answer" }]);
  assert.equal((await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" })).status, 200);
  assert.equal(received.conversation[0].content, "GENERAL_ONLY");
  assert.equal(received.lessonContext, undefined);
});

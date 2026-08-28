const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "phase-one-test-secret-that-is-at-least-32-characters";
process.env.AI_GENERAL_RATE_LIMIT_PER_MINUTE = "100";
process.env.AI_CHATBOT_RECENT_CONTEXT_LIMIT = "3";
process.env.PYTHON_CHATBOT_TIMEOUT_MS = "1000";

const User = require("../models/User");
const ChatbotConversation = require("../models/ChatbotConversation");
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
  originalFetch = global.fetch;
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
  global.fetch = originalFetch;
  User.findById = originalFindById;
  ChatbotConversation.find = originalFind;
  ChatbotConversation.countDocuments = originalCountDocuments;
  ChatbotConversation.deleteMany = originalDeleteMany;
  ChatbotConversation.create = originalCreate;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(() => {
  ChatbotConversation.find = conversationFind([]);
  ChatbotConversation.countDocuments = async () => 0;
  ChatbotConversation.deleteMany = async () => ({ deletedCount: 0 });
  ChatbotConversation.create = async (record) => ({ ...record, _id: "conversation-1", createdAt: new Date("2026-08-28T00:00:00Z") });
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ mode: "general", answer: "A general answer.", responseType: "generated", disclaimer: "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials." }),
  });
});

test("AI routes require authentication", async () => {
  const response = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" }, false);
  assert.equal(response.status, 401);
});

test("general chat sends only general context and stores a general conversation", async () => {
  const filters = [];
  ChatbotConversation.find = conversationFind([{ userMessage: "Earlier", assistantAnswer: "Earlier answer" }], filters);
  let providerPayload;
  global.fetch = async (_url, options) => {
    providerPayload = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ mode: "general", answer: "A general answer.", responseType: "generated", disclaimer: "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials." }) };
  };
  const response = await request("POST", "/api/ai/chat", { mode: "general", message: "  Explain fractions  " });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(providerPayload).sort(), ["conversation", "message", "mode"]);
  assert.equal(providerPayload.message, "Explain fractions");
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

test("quota and unavailable provider errors preserve safe status and messages", async () => {
  global.fetch = async () => ({ ok: false, status: 429, json: async () => ({ category: "quota_exceeded", message: "The General AI Tutor quota is temporarily exhausted. Please try again later." }) });
  const quota = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" });
  assert.equal(quota.status, 429);
  assert.match(quota.body.message, /quota/i);

  global.fetch = async () => { throw new Error("connection refused"); };
  const unavailable = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" });
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.body.message, /temporarily unavailable/i);
});

test("malformed and timed-out provider responses fail safely", async () => {
  global.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } });
  const malformed = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" });
  assert.equal(malformed.status, 502);
  assert.match(malformed.body.message, /invalid response/i);

  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const timeout = await request("POST", "/api/ai/chat", { mode: "general", message: "Hello" });
  assert.equal(timeout.status, 504);
  assert.match(timeout.body.message, /too long/i);
});

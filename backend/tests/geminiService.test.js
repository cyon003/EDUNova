const test = require("node:test");
const assert = require("node:assert/strict");
const { GoogleGenAI } = require("@google/genai");
const { generateAnswer } = require("../services/geminiService");
const models = Object.getPrototypeOf(new GoogleGenAI({ apiKey: "test-key" }).models);
const originalGenerate = models.generateContentInternal;
const originalEnv = { ...process.env };
const reply = (text, finishReason = "STOP") => ({ text, candidates: [{ finishReason }] });
test.beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "gemini-3.6-flash";
  process.env.AI_PROVIDER = "gemini";
  models.generateContentInternal = async () => reply("A complete answer.");
});
test.afterEach(() => { models.generateContentInternal = originalGenerate; process.env = { ...originalEnv }; });

test("official SDK receives configured model, system prompt and recent conversation", async () => {
  let request;
  models.generateContentInternal = async (value) => { request = value; return reply("  A complete answer.  "); };
  const answer = await generateAnswer({ message: "Explain more", conversation: [{ role: "user", content: "Fractions?" }, { role: "assistant", content: "Parts of a whole." }] });
  assert.equal(request.model, "gemini-3.6-flash");
  assert.match(request.contents, /User: Fractions\?\nAssistant: Parts of a whole\./);
  assert.match(request.contents, /explicitly requested more depth/);
  assert.match(request.config.systemInstruction, /Do not claim to have searched the internet/);
  assert.equal(request.config.maxOutputTokens, 1600);
  assert.ok(request.config.abortSignal instanceof AbortSignal);
  assert.deepEqual(answer, { mode: "general", answer: "A complete answer.", responseType: "generated", disclaimer: "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials." });
});

test("simple/default styles and bounded history are retained", async () => {
  const requests = [];
  models.generateContentInternal = async (value) => { requests.push(value); return reply("Answer."); };
  await generateAnswer({ message: "Explain simply", conversation: Array.from({ length: 10 }, () => ({ role: "user", content: "x".repeat(2000) })) });
  await generateAnswer({ message: "What is a fraction?" });
  assert.match(requests[0].contents, /simpler explanation/);
  assert.ok(requests[0].contents.length < 6500);
  assert.match(requests[1].contents, /2 to 4 short sentences/);
  assert.match(requests[1].contents, /\(none\)/);
});

test("truncation triggers one continuation and drops incomplete tails", async () => {
  const requests = [];
  models.generateContentInternal = async (value) => { requests.push(value); return requests.length === 1 ? reply("One sentence. Another", "MAX_TOKENS") : reply("sentence. unfinished", "MAX_TOKENS"); };
  const result = await generateAnswer({ message: "Explain" });
  assert.equal(requests.length, 2);
  assert.match(requests[1].contents, /Partial answer:\nOne sentence. Another/);
  assert.equal(result.answer, "One sentence. Another sentence.");
});

test("answer limit and unclosed delimiters are normalized", async () => {
  process.env.GEMINI_MAX_ANSWER_LENGTH = "400";
  models.generateContentInternal = async () => reply("Complete. " + "x".repeat(450));
  assert.equal((await generateAnswer({ message: "Q" })).answer, "Complete.");
  models.generateContentInternal = async () => reply("Complete. (unfinished");
  assert.equal((await generateAnswer({ message: "Q" })).answer, "Complete.");
});

test("provider errors are mapped without leaking provider messages or keys", async () => {
  for (const [error, status, category] of [
    [{ status: 401 }, 503, "invalid_api_key"], [{ status: 403 }, 503, "invalid_api_key"],
    [{ status: 404 }, 503, "model_unavailable"], [{ status: 429 }, 429, "quota_exceeded"],
    [{ status: 500 }, 502, "api_error"], [{ name: "AbortError" }, 504, "timeout"],
    [new TypeError("fetch failed"), 503, "network_failure"], [new SyntaxError("bad JSON"), 502, "malformed_response"],
  ]) {
    models.generateContentInternal = async () => { throw Object.assign(error, { message: "SECRET provider details" }); };
    await assert.rejects(generateAnswer({ message: "Q" }), (failure) => {
      assert.equal(failure.status, status); assert.equal(failure.category, category);
      assert.doesNotMatch(failure.publicMessage, /SECRET/); return true;
    });
  }
});

test("missing key, blocked and empty responses fail safely", async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(generateAnswer({ message: "Q" }), { category: "missing_api_key", status: 503 });
  process.env.GEMINI_API_KEY = "test-key";
  models.generateContentInternal = async () => reply("", "SAFETY");
  await assert.rejects(generateAnswer({ message: "Q" }), { category: "blocked_response", status: 502 });
  models.generateContentInternal = async () => reply(" ");
  await assert.rejects(generateAnswer({ message: "Q" }), { category: "empty_response", status: 502 });
});

test("SDK retries a temporary 503 and returns the successful answer", async () => {
  models.generateContentInternal = originalGenerate;
  const originalFetch = global.fetch;
  let attempts = 0;
  global.fetch = async () => {
    attempts++;
    if (attempts === 1) return new Response(JSON.stringify({ error: { code: 503, message: "High demand", status: "UNAVAILABLE" } }), { status: 503 });
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: "Recovered answer." }] }, finishReason: "STOP" }] }), { status: 200 });
  };
  try {
    assert.equal((await generateAnswer({ message: "Hello" })).answer, "Recovered answer.");
    assert.equal(attempts, 2);
  } finally { global.fetch = originalFetch; }
});

test("persistent overload stops after three attempts and reports busy", async () => {
  models.generateContentInternal = originalGenerate;
  const originalFetch = global.fetch;
  let attempts = 0;
  global.fetch = async () => { attempts++; return new Response(JSON.stringify({ error: { code: 503, message: "High demand", status: "UNAVAILABLE" } }), { status: 503 }); };
  try {
    await assert.rejects(generateAnswer({ message: "Hello" }), (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.category, "provider_busy");
      assert.match(error.publicMessage, /high demand.*Retry/);
      return true;
    });
    assert.equal(attempts, 3);
  } finally { global.fetch = originalFetch; }
});

test("SDK does not retry authentication or quota errors", async () => {
  models.generateContentInternal = originalGenerate;
  const originalFetch = global.fetch;
  try {
    for (const status of [400, 401, 403, 429]) {
      let attempts = 0;
      global.fetch = async () => { attempts++; return new Response(JSON.stringify({ error: { code: status, message: "Rejected" } }), { status }); };
      await assert.rejects(generateAnswer({ message: "Hello" }));
      assert.equal(attempts, 1);
    }
  } finally { global.fetch = originalFetch; }
});

test("production 429 diagnostics retain quota identifiers and retry info without raw data", async () => {
  process.env.NODE_ENV = "production";
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  const metric = "generativelanguage.googleapis.com/generate_content_requests_free_tier";
  const id = "GenerateRequestsPerDayPerProjectPerModel-FreeTier";
  models.generateContentInternal = async () => { throw Object.assign(new Error(JSON.stringify({ error: {
    code: 429, status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota. test-key private question person@example.com Bearer secret-token",
    details: [
      { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaMetric: metric, quotaId: id, subject: "private-user", description: "private history", quotaDimensions: { user: "private-user" } }] },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "32.5s" },
    ],
  } })), { status: 429, headers: { "retry-after": "33", authorization: "Bearer secret-token" } }); };
  try {
    await assert.rejects(generateAnswer({ message: "private question", conversation: [{ role: "user", content: "private history" }] }), {
      status: 429, category: "quota_exceeded", publicMessage: "General AI has reached its temporary usage limit. Please try again later.",
    });
    assert.deepEqual(logs[0][1], { httpStatus: 429, providerStatus: "RESOURCE_EXHAUSTED", providerCode: 429, providerMessage: "Provider quota exceeded", quotas: [{ metric, id }], retryDelay: "32.5s", retryAfter: "33" });
    assert.doesNotMatch(JSON.stringify(logs), /test-key|private|person@example|Bearer|secret-token|authorization/);
  } finally { console.error = originalError; }
});

test("malformed and adversarial provider diagnostics never log free-form fields", async () => {
  process.env.NODE_ENV = "production";
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    for (const message of ["test-key user question", JSON.stringify({ error: { code: "test-key", status: "private history", message: "private personal data", details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaMetric: "private metric", quotaId: "test-key" }] }, { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "private delay" }] } })]) {
      models.generateContentInternal = async () => { throw Object.assign(new Error(message), { status: 429, headers: { "retry-after": "private header" } }); };
      await assert.rejects(generateAnswer({ message: "Q" }), { category: "quota_exceeded" });
    }
    assert.equal(logs.length, 2);
    assert.doesNotMatch(JSON.stringify(logs), /test-key|private|user question/);
  } finally { console.error = originalError; }
});

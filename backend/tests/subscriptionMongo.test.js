const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

// Dedicated disposable database, never reads the application's .env.
test("subscription MongoDB and HTTP integration", { skip: process.env.RUN_SUBSCRIPTION_MONGO_TESTS !== "true" }, async (t) => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "subscription-test-only-secret-at-least-32-characters";
  process.env.AI_GENERAL_RATE_LIMIT_PER_MINUTE = "100";
  process.env.AI_CHATBOT_RECENT_CONTEXT_LIMIT = "0";
  const mongoose = require("mongoose");
  const jwt = require("jsonwebtoken");
  const User = require("../models/User");
  const Usage = require("../models/AiUsage");
  const service = require("../services/subscriptionService");
  const temp = await mkdtemp(path.join(os.tmpdir(), "edunova-subscription-test-"));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const mongo = spawn("mongod", ["--dbpath", temp, "--port", String(port), "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  let server;
  const nativeFetch = global.fetch;
  const geminiService = require("../services/geminiService");
  const originalGenerate = geminiService.generateAnswer;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Test mongod startup timed out")), 15000);
      mongo.once("error", (error) => { clearTimeout(timeout); reject(error); });
      mongo.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Test mongod exited: ${code}`)); });
      mongo.stdout.on("data", (chunk) => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timeout); resolve(); } });
    });
    await mongoose.connect(`mongodb://127.0.0.1:${port}/subscription_test`);
    const student = await User.create({ name: "Test", email: "student@example.test", password: "unused" });
    const admin = await User.create({ name: "Admin", email: "admin@example.test", password: "unused", role: "admin" });
    const tutor = await User.create({ name: "Tutor", email: "tutor@example.test", password: "unused", role: "tutor" });
    server = require("../app").listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const request = async (method, route, body, user = student) => {
      const response = await nativeFetch(`http://127.0.0.1:${server.address().port}/api${route}`, { method,
        headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      return { status: response.status, data };
    };
    const success = async () => ({ mode: "general", responseType: "generated", answer: "Test answer", disclaimer: "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials." });
    geminiService.generateAnswer = success;
    await t.test("legacy user and endpoint authentication", async () => {
      await User.collection.updateOne({ _id: student._id }, { $unset: { subscription: "" } });
      assert.equal((await request("GET", "/subscription/me")).data.plan, "free");
      for (const [method, route] of [["GET", "/me"], ["POST", "/upgrade"], ["POST", "/dev/simulate"]]) assert.equal((await request(method, `/subscription${route}`, method === "POST" ? {} : undefined, null)).status, 401);
    });
    await t.test("five successful chats then sixth rejected; history deletion preserves quota", async () => {
      for (let i = 0; i < 5; i++) assert.equal((await request("POST", "/ai/chat", { mode: "general", message: "Hello" })).status, 200);
      const blocked = await request("POST", "/ai/chat", { mode: "general", message: "Hello" });
      assert.equal(blocked.status, 429); assert.equal(blocked.data.code, "AI_QUOTA_EXCEEDED");
      assert.equal(blocked.data.aiUsage.used, 5);
      const history = await request("GET", "/ai/history?mode=general");
      assert.equal(history.data.total, 5);
      assert.equal(history.data.items[0].assistantAnswer, "Test answer");
      await request("DELETE", "/ai/history?mode=general");
      assert.equal((await request("GET", "/subscription/me")).data.aiUsage.used, 5);
    });
    await t.test("20 concurrent first requests reserve only five slots", async () => {
      await Usage.deleteMany({});
      const results = await Promise.allSettled(Array.from({ length: 20 }, () => service.reserveUsage(student)));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
      for (const r of results.filter((r) => r.status === "fulfilled")) await service.settleUsage(r.value, true);
      assert.equal((await service.getSubscription(student)).aiUsage.used, 5);
    });
    await t.test("daily/monthly resets and 500th Premium message", async () => {
      await Usage.deleteMany({});
      const now = new Date();
      const a = service.allowance(student, now);
      await Usage.create({ _id: a.key, used: 5 });
      assert.equal((await service.getSubscription(student, a.resetAt)).aiUsage.used, 0);
      const premium = { _id: student._id, role: "student", subscription: service.premiumSubscription("yearly", now) };
      const monthly = service.allowance(premium, now);
      await Usage.create({ _id: monthly.key, used: 499 });
      const last = await service.reserveUsage(premium);
      await service.settleUsage(last, true);
      await assert.rejects(service.reserveUsage(premium), (error) => error.quota.limit === 500);
      assert.equal((await service.getSubscription(premium, monthly.resetAt)).aiUsage.used, 0);
      await Usage.deleteMany({});
      await Usage.create({ _id: a.key, used: 4, pending: [{ token: "abandoned", expiresAt: new Date(0) }] });
      assert.ok(await service.reserveUsage(student));
    });
    await t.test("failed and invalid chatbot responses release capacity", async () => {
      await Usage.deleteMany({});
      for (const provider of [async () => { throw Object.assign(new Error("network_failure"), { status: 503, publicMessage: "The General AI Tutor is temporarily unavailable." }); }, async () => ({ answer: "invalid" })]) {
        geminiService.generateAnswer = provider;
        assert.equal((await request("POST", "/ai/chat", { mode: "general", message: "Hello" })).status, 503);
        const usage = (await request("GET", "/subscription/me")).data.aiUsage;
        assert.equal(usage.used, 0); assert.equal(usage.pending, 0);
      }
      geminiService.generateAnswer = success;
    });
    await t.test("saving failure releases reservation and expired Premium uses Free allowance", async () => {
      await Usage.deleteMany({});
      const Conversation = require("../models/ChatbotConversation");
      const originalCreate = Conversation.create;
      Conversation.create = async () => { throw new Error("Simulated history write failure"); };
      try {
        assert.equal((await request("POST", "/ai/chat", { mode: "general", message: "Hello" })).status, 500);
        assert.equal((await service.getSubscription(student)).aiUsage.remaining, 5);
      } finally { Conversation.create = originalCreate; }
      await User.updateOne({ _id: student._id }, { $set: { subscription: { plan: "premium", status: "active", billingCycle: "monthly", startDate: new Date(0), endDate: new Date(1) } } });
      const expired = (await request("GET", "/subscription/me")).data;
      assert.equal(expired.plan, "free"); assert.equal(expired.status, "expired"); assert.equal(expired.aiUsage.limit, 5);
      await request("PATCH", "/profile", { name: "Test", subscription: { plan: "premium" } });
      assert.equal((await request("GET", "/subscription/me")).data.plan, "free");
    });
    await t.test("self-promotion blocked and development admin simulation protected", async () => {
      const body = { userId: student.id, plan: "premium", billingCycle: "monthly" };
      assert.equal((await request("POST", "/subscription/upgrade", body)).status, 400);
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "monthly", totalAmount: 1 })).status, 400);
      process.env.ENABLE_DEV_SUBSCRIPTIONS = "true";
      for (const environment of ["production", "staging", "test"]) {
        process.env.NODE_ENV = environment;
        assert.equal((await request("POST", "/subscription/dev/simulate", body, admin)).status, 404);
      }
      process.env.NODE_ENV = "development";
      process.env.ENABLE_DEV_SUBSCRIPTIONS = "false";
      assert.equal((await request("POST", "/subscription/dev/simulate", body, admin)).status, 404);
      process.env.ENABLE_DEV_SUBSCRIPTIONS = "true";
      assert.equal((await request("POST", "/subscription/dev/simulate", body)).status, 403);
      assert.equal((await request("POST", "/subscription/dev/simulate", { ...body, billingCycle: "invalid" }, admin)).status, 400);
      assert.equal((await request("POST", "/subscription/dev/simulate", body, admin)).data.plan, "premium");
      const before = (await User.findById(student._id)).subscription.toObject();
      for (const payload of [{}, { plan: "free" }]) {
        assert.equal((await request("POST", "/subscription/cancel", payload)).status, 404);
      }
      const after = (await User.findById(student._id)).subscription.toObject();
      assert.deepEqual(after, before);
      assert.equal((await request("GET", "/subscription/me")).data.plan, "premium");
      assert.equal((await request("POST", "/subscription/dev/simulate", { userId: student.id, plan: "free" }, admin)).data.plan, "free");
      process.env.NODE_ENV = "test";
    });
    await t.test("staff remain exempt and short-term rate limiting still works", async () => {
      for (const staff of [tutor, admin]) {
        assert.equal((await request("GET", "/subscription/me", undefined, staff)).data.aiUsage.exempt, true);
        assert.equal((await request("POST", "/ai/chat", { mode: "general", message: "Hello" }, staff)).status, 200);
      }
      process.env.AI_GENERAL_RATE_LIMIT_PER_MINUTE = "1";
      const blocked = await request("POST", "/ai/chat", { mode: "general", message: "Hello" }, tutor);
      assert.equal(blocked.status, 429); assert.match(blocked.data.message, /Too many/);
    });
  } finally {
    geminiService.generateAnswer = originalGenerate;
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongo.exitCode === null) { mongo.kill("SIGTERM"); await new Promise((resolve) => mongo.once("exit", resolve)); }
    await rm(temp, { recursive: true, force: true });
  }
});

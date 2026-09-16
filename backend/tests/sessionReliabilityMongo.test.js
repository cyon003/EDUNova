const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { setTimeout: delay } = require("node:timers/promises");

// Disposable replica set only; never reads .env or an application database.
test("session rotation and rejection HTTP integration", { skip: process.env.RUN_AUTH_MONGO_TESTS !== "true" }, async (t) => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "auth-test-only-secret-at-least-32-characters";
  const mongoose = require("mongoose");
  const express = require("express");
  const User = require("../models/User");
  const PlatformSetting = require("../models/PlatformSetting");
  const service = require("../services/sessionService");
  const { RefreshSession } = service;
  const temp = await mkdtemp(path.join(os.tmpdir(), "edunova-auth-test-"));
  process.env.UPLOAD_ROOT = path.join(temp, "uploads");
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const mongo = spawn("mongod", ["--dbpath", temp, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "authTest", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  let server;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Test MongoDB startup timed out")), 20000);
      mongo.once("error", error => { clearTimeout(timer); reject(error); });
      mongo.once("exit", code => { clearTimeout(timer); reject(new Error(`Test MongoDB exited ${code}`)); });
      mongo.stdout.on("data", chunk => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    });
    // Bootstrap before connecting Mongoose: automatic model creation must wait
    // until this disposable replica set has elected a writable primary.
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
      await bootstrap.connect();
      await bootstrap.db().admin().command({ replSetInitiate: { _id: "authTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      for (let i = 0; ; i++) {
        if ((await bootstrap.db().admin().command({ hello: 1 })).isWritablePrimary) break;
        if (i > 100) throw new Error("Replica set did not elect a primary");
        await delay(100);
      }
    } finally {
      await bootstrap.close();
    }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/auth_test?replicaSet=authTest`);
    await Promise.all([User, PlatformSetting, RefreshSession].map(model => model.init()));
    const user = await User.create({ name: "Session test", email: "session@example.test", password: "unused" });
    const app = express(); app.use(express.json()); app.use("/api/auth", require("../routes/authRoutes"));
    server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    const request = { get: () => "test", ip: "127.0.0.1" };
    const seed = () => service.createSession(user, request);
    const refresh = async raw => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/refresh`, {
        method: "POST", headers: raw ? { Cookie: `${service.cookieName()}=${raw}` } : {},
      });
      return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
    };
    const cookieValue = response => response.cookie.split(";")[0].split("=").slice(1).join("=");

    await t.test("successful refresh rotates, keeps deadline and does not alter cookie protections", async () => {
      const old = await seed(); const result = await refresh(old.rawToken);
      assert.equal(result.status, 200);
      assert.ok(result.body.token); assert.ok(cookieValue(result) !== old.rawToken);
      assert.ok(result.cookie.includes("HttpOnly")); assert.ok(result.cookie.includes("SameSite=Lax"));
      assert.ok(result.cookie.includes("Path=/api/auth"));
      const previous = await RefreshSession.findOne({ tokenHash: old.tokenHash });
      assert.equal(previous.revokeReason, "rotated");
      const next = await RefreshSession.findOne({ tokenHash: service.hashToken(cookieValue(result)) });
      assert.equal(next.expiresAt.getTime(), old.expiresAt.getTime());
      assert.equal(next.startedAt.getTime(), old.startedAt.getTime());
    });

    await t.test("replacement failure returns 503, preserves cookie and rolls back old-token consumption", async () => {
      const old = await seed(); const original = RefreshSession.create;
      RefreshSession.create = async () => { throw new Error("simulated database failure"); };
      let result; try { result = await refresh(old.rawToken); } finally { RefreshSession.create = original; }
      assert.equal(result.status, 503); assert.equal(result.cookie, null);
      assert.equal(result.body.code, "SESSION_UNAVAILABLE");
      assert.equal(JSON.stringify(result.body).includes("simulated database"), false);
      const unchanged = await RefreshSession.findOne({ tokenHash: old.tokenHash });
      assert.equal(unchanged.revokedAt, null);
      assert.equal(await RefreshSession.countDocuments({ familyId: old.familyId }), 1);
      assert.equal((await refresh(old.rawToken)).status, 200);
    });

    await t.test("database lookup failure is 503 without a clearing cookie", async () => {
      const old = await seed(); const original = RefreshSession.findOne;
      RefreshSession.findOne = () => { throw new Error("simulated lookup failure"); };
      let result; try { result = await refresh(old.rawToken); } finally { RefreshSession.findOne = original; }
      assert.equal(result.status, 503); assert.equal(result.cookie, null);
      assert.equal((await refresh(old.rawToken)).status, 200);
    });

    await t.test("failure after replacement insert rolls back both session writes", async () => {
      const old = await seed(); const original = RefreshSession.updateOne;
      RefreshSession.updateOne = () => { throw new Error("simulated linking failure"); };
      let result; try { result = await refresh(old.rawToken); } finally { RefreshSession.updateOne = original; }
      assert.equal(result.status, 503); assert.equal(result.cookie, null);
      assert.equal(await RefreshSession.countDocuments({ familyId: old.familyId }), 1);
      assert.equal((await RefreshSession.findOne({ tokenHash: old.tokenHash })).revokedAt, null);
      assert.equal((await refresh(old.rawToken)).status, 200);
    });

    await t.test("actual replay rejects old token and revokes its replacement family", async () => {
      const old = await seed(); const rotated = await refresh(old.rawToken);
      assert.equal(rotated.status, 200);
      const replay = await refresh(old.rawToken);
      assert.equal(replay.status, 401); assert.equal(replay.body.code, "SESSION_REJECTED");
      assert.ok(replay.cookie.includes("Expires=Thu, 01 Jan 1970"));
      const successor = await RefreshSession.findOne({ tokenHash: service.hashToken(cookieValue(rotated)) });
      assert.equal(successor.revokeReason, "reuse_detected");
      assert.equal((await refresh(cookieValue(rotated))).status, 401);
    });

    await t.test("concurrent direct replay remains rejected under transaction retries", async () => {
      const old = await seed();
      const results = await Promise.all([refresh(old.rawToken), refresh(old.rawToken)]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 401]);
      assert.equal(await RefreshSession.countDocuments({ familyId: old.familyId, revokedAt: null }), 0);
    });

    await t.test("missing, malformed, unknown, revoked and expired refresh sessions reject with 401", async () => {
      for (const raw of [null, "%zz", "unknown"]) {
        const result = await refresh(raw); assert.equal(result.status, 401); assert.ok(result.cookie);
      }
      for (const patch of [{ revokedAt: new Date(), revokeReason: "logout" }, { expiresAt: new Date(0) }]) {
        const old = await seed(); await RefreshSession.updateOne({ tokenHash: old.tokenHash }, { $set: patch });
        const result = await refresh(old.rawToken); assert.equal(result.status, 401); assert.ok(result.cookie);
      }
    });

    await t.test("absolute maximum session deadline still rejects refresh even if token expiry is later", async () => {
      const old = await seed();
      await PlatformSetting.create({ key: "platform", sessionTimeout: 1 });
      await RefreshSession.updateOne({ tokenHash: old.tokenHash }, { $set: { startedAt: new Date(Date.now() - 120000) } });
      const result = await refresh(old.rawToken);
      assert.equal(result.status, 401); assert.equal(result.body.code, "SESSION_REJECTED");
      assert.equal(await RefreshSession.countDocuments({ familyId: old.familyId }), 1);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo.exitCode === null) { mongo.kill("SIGTERM"); await new Promise(resolve => mongo.once("exit", resolve)); }
    await rm(temp, { recursive: true, force: true });
  }
});

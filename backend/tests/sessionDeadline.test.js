const assert = require("node:assert/strict");
const test = require("node:test");

process.env.JWT_SECRET = "session-deadline-test-secret-at-least-32-characters";
const jwt = require("jsonwebtoken");
const { accessToken, durationSeconds, sessionDeadline } = require("../services/sessionService");

test("session deadline is fixed from login and never extends during refresh", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const maximumExpiry = new Date("2026-02-01T00:00:00.000Z");
  const deadline = sessionDeadline(startedAt, 30, maximumExpiry);
  assert.equal(deadline.toISOString(), "2026-01-01T00:30:00.000Z");
  assert.equal(sessionDeadline(startedAt, 30, deadline).toISOString(), deadline.toISOString());
  assert.throws(() => sessionDeadline(startedAt, 0, maximumExpiry), /Invalid session timeout/);
});

test("access token is bounded by the refresh-session deadline", () => {
  const expiration = new Date(Date.now() + 3_000);
  const token = accessToken({ _id: "student-id", role: "student", tokenVersion: 2 }, { expiresAt: expiration });
  const claims = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(claims.id, "student-id");
  assert.equal(claims.tokenVersion, 2);
  assert.ok(claims.exp * 1000 <= expiration.getTime() + 1000);
  assert.equal(durationSeconds("15m"), 900);
  assert.equal(durationSeconds("2h"), 7200);
});

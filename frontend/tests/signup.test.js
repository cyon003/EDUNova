import assert from "node:assert/strict";
import test from "node:test";
import { signup } from "../src/utils/signup.js";

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
test("signup handles empty proxy failures without exposing JSON parser errors", async () => {
  globalThis.fetch = async () => new Response("", { status: 500 });
  await assert.rejects(signup({}), /temporarily unavailable/);
});
test("signup handles HTML gateway failures and connection failures", async () => {
  globalThis.fetch = async () => new Response("<html>Bad gateway</html>", { status: 502 });
  await assert.rejects(signup({}), /temporarily unavailable/);
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(signup({}), /Unable to reach EDUNova/);
});
test("signup preserves server validation messages", async () => {
  globalThis.fetch = async () => Response.json({ message: "Email already exists" }, { status: 400 });
  await assert.rejects(signup({}), /Email already exists/);
});
test("empty or malformed successful responses do not report account creation", async () => {
  for (const body of ["", "null", "{}", '{"message":42}']) {
    globalThis.fetch = async () => new Response(body, { status: 201 });
    await assert.rejects(signup({}), /couldn't confirm your signup/);
  }
});
test("signup sends credentials and returns confirmed success", async () => {
  const details = { name: "Student", email: "student@example.test", password: "test-only" };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/auth/signup");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    assert.deepEqual(JSON.parse(options.body), details);
    return Response.json({ message: "Account created" }, { status: 201 });
  };
  assert.equal((await signup(details)).message, "Account created");
});

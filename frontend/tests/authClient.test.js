import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map();
const listeners = new Map();
const requests = [];

globalThis.window = {
  location: { origin: "http://localhost" },
  addEventListener(type, listener) { listeners.set(type, listener); },
  removeEventListener(type) { listeners.delete(type); },
  dispatchEvent(event) { listeners.get(event.type)?.(event); },
};
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.sessionStorage = { removeItem() {}, setItem() {} };
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};

const users = {
  "a@example.com": { id: "507f1f77bcf86cd799439061", role: "student" },
  "b@example.com": { id: "507f1f77bcf86cd799439062", role: "student" },
};

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const body = init.body ? JSON.parse(init.body) : {};
  requests.push({ url, headers: new Headers(init.headers || {}) });
  if (url.endsWith("/auth/login")) {
    const user = users[body.email];
    return new Response(JSON.stringify({ message: "Login successful", user, token: `token-${body.email[0]}` }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url.endsWith("/auth/logout")) return new Response(JSON.stringify({ message: "Logged out" }), { status: 200 });
  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
};

const { installAuthFetch, login, logout } = await import("../src/utils/authClient.js");
installAuthFetch();

test("logout and login replace the identity used by learning-signal requests", async () => {
  await login({ email: "a@example.com", password: "password" });
  await fetch("http://localhost/api/learning-signals/course/lesson", { headers: { Authorization: "Bearer stale" } });
  await logout();
  await login({ email: "b@example.com", password: "password" });
  await fetch("http://localhost/api/learning-signals/course/lesson", { headers: { Authorization: "Bearer stale" } });

  const signalRequests = requests.filter(({ url }) => url.includes("/learning-signals/"));
  assert.deepEqual(signalRequests.map(({ headers }) => headers.get("Authorization")), ["Bearer token-a", "Bearer token-b"]);
  assert.equal(storage.get("token"), "managed-in-memory");
  assert.equal(JSON.parse(storage.get("user")).id, users["b@example.com"].id);
});
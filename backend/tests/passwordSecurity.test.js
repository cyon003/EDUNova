const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPasswordResetUrl } = require("../utils/passwordSecurity");

test("buildPasswordResetUrl creates a frontend reset link", () => {
  assert.equal(
    buildPasswordResetUrl("https://edunova.example/", "reset token"),
    "https://edunova.example/reset-password/reset%20token"
  );
});

test("buildPasswordResetUrl defaults to the local frontend", () => {
  assert.equal(
    buildPasswordResetUrl(undefined, "abc123"),
    "http://localhost:5173/reset-password/abc123"
  );
});

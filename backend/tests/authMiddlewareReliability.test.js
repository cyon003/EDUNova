const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authenticate = require("../middleware/authMiddleware");
process.env.JWT_SECRET = "local-auth-middleware-test-only-secret";
async function request(token) {
  let status = 200, body, passed = false;
  await authenticate({ headers: { authorization: `Bearer ${token}` } }, {
    status(value) { status = value; return this; }, json(value) { body = value; return this; },
  }, () => { passed = true; });
  return { status, body, passed };
}
test("authentication database outage is recoverable, not an invalid session", async () => {
  const original = User.findById;
  User.findById = () => ({ select: async () => { throw new Error("database unavailable"); } });
  try {
    const token = jwt.sign({ id: "507f1f77bcf86cd799439011" }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const result = await request(token);
    assert.equal(result.status, 503);
    assert.equal(result.passed, false);
    assert.equal(result.body.code, "AUTH_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(result.body), /database unavailable/);
  } finally { User.findById = original; }
});
test("expired and forged access tokens still reject without querying the database", async () => {
  const original = User.findById;
  User.findById = () => { throw new Error("must not reach database"); };
  try {
    for (const token of [jwt.sign({ id: "user" }, process.env.JWT_SECRET, { expiresIn: -1 }), "forged"]) {
      assert.equal((await request(token)).status, 401);
    }
  } finally { User.findById = original; }
});

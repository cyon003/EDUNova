const test = require("node:test");
const assert = require("node:assert/strict");

const { trustProxySetting } = require("../config/environment");

test("trusted proxy is disabled unless explicitly enabled", () => {
  const original = process.env.TRUST_PROXY;
  try {
    delete process.env.TRUST_PROXY;
    assert.equal(trustProxySetting(), false);
    process.env.TRUST_PROXY = "false";
    assert.equal(trustProxySetting(), false);
    process.env.TRUST_PROXY = "true";
    assert.equal(trustProxySetting(), 1);
    process.env.TRUST_PROXY = "1";
    assert.equal(trustProxySetting(), 1);
  } finally {
    if (original === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = original;
  }
});

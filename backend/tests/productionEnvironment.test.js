const assert = require("node:assert/strict");
const test = require("node:test");
const { validateEnvironment } = require("../config/environment");

function productionEnvironment(overrides = {}) {
  return {
    NODE_ENV: "production",
    PORT: "5050",
    MONGO_URI: "mongodb://localhost:27017/edunova?replicaSet=rs0",
    JWT_SECRET: "production-test-secret-at-least-32-characters",
    FRONTEND_URL: "https://example.test",
    UPLOAD_ROOT: "/srv/edunova/uploads",
    EMAIL_HOST: "smtp.example.test",
    EMAIL_USER: "mailer",
    EMAIL_PASSWORD: "not-a-real-secret",
    EMAIL_FROM: "EDUNOVA <no-reply@example.test>",
    PYTHON_CHATBOT_URL: "http://127.0.0.1:5001",
    PYTHON_CONFUSION_URL: "http://127.0.0.1:5002",
    ...overrides,
  };
}

test("production configuration requires persistent storage and operational services", () => {
  const original = { ...process.env };
  Object.assign(process.env, productionEnvironment());
  assert.deepEqual(validateEnvironment(), { port: 5050 });
  process.env.UPLOAD_ROOT = "relative/uploads";
  assert.throws(validateEnvironment, /UPLOAD_ROOT must be an absolute persistent-storage path/);
  Object.assign(process.env, original);
});

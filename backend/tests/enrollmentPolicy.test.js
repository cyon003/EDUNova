const assert = require("node:assert/strict");
const test = require("node:test");
const { checkEnrollmentPolicy } = require("../services/enrollmentPolicy");

const course = { moderationStatus: "published", price: 0 };

test("enrollment policy consistently requires a published course and capacity", () => {
  assert.doesNotThrow(() => checkEnrollmentPolicy({ maxEnrollment: 2, allowSelfEnroll: true }, course, 1));
  assert.throws(
    () => checkEnrollmentPolicy({ maxEnrollment: 2, allowSelfEnroll: true }, course, 2),
    { status: 409, message: "This course has reached its enrollment limit" }
  );
  assert.throws(
    () => checkEnrollmentPolicy({ maxEnrollment: 2, allowSelfEnroll: true }, { ...course, moderationStatus: "pending" }, 0),
    { status: 403, message: "This course is not published for enrollment" }
  );
});

test("admin payment approval can bypass self-enrollment only", () => {
  assert.throws(
    () => checkEnrollmentPolicy({ maxEnrollment: 2, allowSelfEnroll: false }, course, 0),
    { status: 403, message: "Self-enrollment is currently disabled" }
  );
  assert.doesNotThrow(() => checkEnrollmentPolicy({ maxEnrollment: 2, allowSelfEnroll: false }, course, 0, { selfEnrollment: false }));
  assert.throws(
    () => checkEnrollmentPolicy({ maxEnrollment: 1, allowSelfEnroll: false }, course, 1, { selfEnrollment: false }),
    { status: 409, message: "This course has reached its enrollment limit" }
  );
});

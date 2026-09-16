const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("../services/subscriptionService");
const now = new Date("2026-09-15T12:00:00Z");
const student = { _id: "student", role: "student" };
test("legacy Free, UTC reset and staff exemptions", () => {
  assert.equal(service.currentSubscription(student, now).plan, "free");
  const a = service.allowance(student, now);
  assert.equal(a.limit, 5);
  assert.equal(a.resetAt.toISOString(), "2026-09-16T00:00:00.000Z");
  assert.notEqual(a.key, service.allowance(student, a.resetAt).key);
  for (const role of ["tutor", "admin"]) assert.equal(service.allowance({ role }, now).exempt, true);
});
test("Premium monthly/yearly allowances and expiration", () => {
  for (const cycle of ["monthly", "yearly"]) {
    const subscription = service.premiumSubscription(cycle, now);
    const user = { ...student, subscription };
    const a = service.allowance(user, now);
    assert.equal(a.limit, 500);
    assert.equal(a.resetAt.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.notEqual(a.key, service.allowance(user, a.resetAt).key);
    assert.equal(service.currentSubscription(user, new Date(subscription.endDate.getTime() - 1)).plan, "premium");
    assert.equal(service.currentSubscription(user, subscription.endDate).plan, "free");
    assert.equal(service.currentSubscription(user, subscription.endDate).status, "expired");
    for (const patch of [{ status: "cancelled" }, { endDate: null }, { startDate: new Date("2027-01-01") }]) assert.equal(service.currentSubscription({ subscription: { ...subscription, ...patch } }, now).plan, "free");
  }
  assert.equal(service.premiumSubscription("monthly", new Date("2026-01-31T12:00:00Z")).endDate.toISOString(), "2026-02-28T12:00:00.000Z");
});

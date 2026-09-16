const test = require("node:test");
const assert = require("node:assert/strict");
const { extendedPremium } = require("../services/subscriptionPaymentService");
const { allowance } = require("../services/subscriptionService");
const Order = require("../models/Order");
const now = new Date("2028-01-31T12:00:00Z");

test("Premium uses calendar months/years with month-end and leap-year clamping", () => {
  assert.equal(extendedPremium({}, "monthly", now).endDate.toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(extendedPremium({}, "yearly", new Date("2028-02-29T12:00:00Z")).endDate.toISOString(), "2029-02-28T12:00:00.000Z");
});
test("active Premium retains paid time; expired or cancelled Premium starts at approval", () => {
  const user = { subscription: { plan: "premium", status: "active", startDate: new Date("2028-01-01"), endDate: new Date("2028-03-31T12:00:00Z") } };
  assert.equal(extendedPremium(user, "monthly", now).endDate.toISOString(), "2028-04-30T12:00:00.000Z");
  assert.equal(extendedPremium(user, "yearly", now).endDate.toISOString(), "2029-03-31T12:00:00.000Z");
  assert.equal(extendedPremium(user, "monthly", now).startDate.toISOString(), "2028-01-01T00:00:00.000Z");
  user.subscription.status = "cancelled";
  assert.equal(extendedPremium(user, "monthly", now).startDate, now);
  user.subscription.status = "active"; user.subscription.endDate = new Date("2027-01-01");
  assert.equal(extendedPremium(user, "monthly", now).endDate.toISOString(), "2028-02-29T12:00:00.000Z");
});
test("monthly and yearly purchases both retain 500/month, expired users get 5/day", () => {
  for (const billingCycle of ["monthly", "yearly"]) {
    const user = { role: "student", subscription: extendedPremium({}, billingCycle, now) };
    assert.equal(allowance(user, now).limit, 500);
    assert.equal(allowance(user, now).period, "monthly");
    assert.equal(allowance(user, user.subscription.endDate).limit, 5);
  }
});
test("subscription order schema rejects wrong price/cycle and course items", async () => {
  const base = { student: "507f1f77bcf86cd799439011", paymentType: "subscription", billingCycle: "monthly", totalAmount: 99, orderReference: "EDU-PREM-test" };
  await new Order(base).validate();
  await new Order({ ...base, billingCycle: "yearly", totalAmount: 999 }).validate();
  for (const patch of [{ totalAmount: 1 }, { billingCycle: "weekly" }, { items: [{ course: base.student, price: 99 }] }, { paymentMethod: "free" }]) await assert.rejects(new Order({ ...base, ...patch }).validate());
  await assert.rejects(new Order({ ...base, paymentType: "course", items: [{ price: 99 }], billingCycle: undefined }).validate());
});

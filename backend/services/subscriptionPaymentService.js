const crypto = require("node:crypto");
const Order = require("../models/Order");
const User = require("../models/User");
const { purchaseTransaction, policyError } = require("./enrollmentPolicy");
const { currentSubscription, premiumSubscription } = require("./subscriptionService");

const PRICES = Object.freeze({ monthly: 99, yearly: 999 });

async function checkoutSubscription(studentId, billingCycle) {
  if (!Object.hasOwn(PRICES, billingCycle)) throw policyError(400, "Choose monthly or yearly billing");
  return purchaseTransaction(studentId, async (session) => {
    // The shared purchase lock serializes checkouts and fulfillment for this student.
    const existing = await Order.findOne({ student: studentId, paymentType: "subscription", paymentMethod: "stripe", status: "pending" }).session(session).sort({ createdAt: -1 });
    if (existing) return { status: 200, body: { order: existing, existing: true, message: "Continue your existing Premium payment before starting another." } };
    const [order] = await Order.create([{
      student: studentId, paymentType: "subscription", billingCycle, items: [],
      totalAmount: PRICES[billingCycle], orderReference: `EDU-PREM-${crypto.randomUUID().toUpperCase()}`,
      paymentMethod: "stripe", status: "pending",
    }], { session });
    return { status: 201, body: { order, message: "Continue to Stripe. Premium activates after confirmed payment." } };
  });
}

function extendedPremium(user, billingCycle, now = new Date()) {
  const active = currentSubscription(user, now).plan === "premium";
  const baseDate = active ? new Date(user.subscription.endDate) : now;
  const subscription = premiumSubscription(billingCycle, baseDate);
  // Preserve the original start while extending an active, paid period.
  subscription.startDate = active ? new Date(user.subscription.startDate) : now;
  return subscription;
}

// Called only by verified Stripe fulfillment inside the purchase transaction.
async function activateSubscription(order, session, now = new Date()) {
  if (order.paymentType !== "subscription" || !Object.hasOwn(PRICES, order.billingCycle)
      || order.totalAmount !== PRICES[order.billingCycle] || order.items.length || order.paymentMethod !== "stripe" || order.status !== "completed") {
    throw policyError(400, "Invalid Premium payment details");
  }
  const user = await User.findById(order.student).session(session);
  if (!user || user.role !== "student") throw policyError(400, "Premium payment requires a student account");
  user.subscription = extendedPremium(user, order.billingCycle, now);
  await user.save({ session });
}

module.exports = { checkoutSubscription, activateSubscription, extendedPremium };

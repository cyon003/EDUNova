const { randomUUID } = require("node:crypto");
const AiUsage = require("../models/AiUsage");
const User = require("../models/User");

function currentSubscription(user, now = new Date()) {
  const value = user.subscription || {};
  const active = value.plan === "premium" && value.status === "active" &&
    value.startDate && new Date(value.startDate) <= now && value.endDate && new Date(value.endDate) > now;
  return {
    plan: active ? "premium" : "free",
    status: value.plan === "premium" && value.status === "active" && !active ? "expired" : value.status || "active",
    billingCycle: active ? value.billingCycle : null,
    startDate: value.startDate || null, endDate: value.endDate || null,
  };
}

function allowance(user, now = new Date()) {
  const subscription = currentSubscription(user, now);
  if (["tutor", "admin"].includes(user.role)) return { ...subscription, exempt: true, limit: null, period: null, resetAt: null };
  const premium = subscription.plan === "premium";
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), premium ? 1 : now.getUTCDate()));
  const resetAt = new Date(start);
  if (premium) resetAt.setUTCMonth(resetAt.getUTCMonth() + 1);
  else resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { ...subscription, exempt: false, limit: premium ? 500 : 5, period: premium ? "monthly" : "daily", resetAt, key: `${user._id}:${premium ? "monthly" : "daily"}:${start.toISOString()}` };
}

async function getSubscription(user, now = new Date()) {
  const a = allowance(user, now);
  const record = a.exempt ? null : await AiUsage.findById(a.key).lean();
  const used = record?.used || 0;
  const pending = (record?.pending || []).filter((item) => new Date(item.expiresAt) > now).length;
  return { ...currentSubscription(user, now), aiUsage: { used, pending, limit: a.limit, remaining: a.exempt ? null : Math.max(0, a.limit - used - pending), period: a.period, resetAt: a.resetAt, exempt: a.exempt } };
}

async function reserveUsage(user, now = new Date()) {
  const a = allowance(user, now);
  if (a.exempt) return null;
  try {
    await AiUsage.updateOne({ _id: a.key }, { $setOnInsert: { used: 0, pending: [] } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  // Leases recover capacity after a crashed worker; ten minutes exceeds provider timeout.
  await AiUsage.updateOne({ _id: a.key }, { $pull: { pending: { expiresAt: { $lte: now } } } });
  const token = randomUUID();
  const record = await AiUsage.findOneAndUpdate({ _id: a.key, $expr: { $lt: [{ $add: ["$used", { $size: "$pending" }] }, a.limit] } },
    { $push: { pending: { token, expiresAt: new Date(now.getTime() + 600000) } } }, { returnDocument: "after" });
  if (!record) {
    const subscription = await getSubscription(user, now);
    throw Object.assign(new Error("AI quota exceeded"), { status: 429, quota: { code: "AI_QUOTA_EXCEEDED", ...subscription, limit: a.limit, message: `You have reached your ${a.period === "daily" ? "daily" : "monthly"} AI limit.` } });
  }
  return { key: a.key, token };
}

async function settleUsage(reservation, successful) {
  if (!reservation) return;
  const result = await AiUsage.updateOne({ _id: reservation.key, pending: { $elemMatch: { token: reservation.token, ...(successful ? { expiresAt: { $gt: new Date() } } : {}) } } },
    { $pull: { pending: { token: reservation.token } }, ...(successful ? { $inc: { used: 1 } } : {}) });
  if (successful && result.modifiedCount !== 1) throw new Error("AI usage reservation expired");
}

function premiumSubscription(billingCycle, now = new Date()) {
  const endDate = new Date(now);
  const day = endDate.getUTCDate();
  endDate.setUTCDate(1);
  endDate.setUTCMonth(endDate.getUTCMonth() + (billingCycle === "yearly" ? 12 : 1));
  const lastDay = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0)).getUTCDate();
  endDate.setUTCDate(Math.min(day, lastDay));
  return { plan: "premium", status: "active", billingCycle, startDate: now, endDate };
}

async function cancelSubscription(user) {
  return User.findByIdAndUpdate(user._id, { $set: { subscription: { plan: "free", status: "cancelled", billingCycle: null, startDate: null, endDate: new Date() } } }, { returnDocument: "after", runValidators: true });
}
module.exports = { currentSubscription, allowance, getSubscription, reserveUsage, settleUsage, premiumSubscription, cancelSubscription };

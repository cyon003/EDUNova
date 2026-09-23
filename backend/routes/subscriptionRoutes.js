const express = require("express");
const mongoose = require("mongoose");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const Order = require("../models/Order");
const User = require("../models/User");
const AdminAudit = require("../models/AdminAudit");
const { checkoutSubscription } = require("../services/subscriptionPaymentService");
const service = require("../services/subscriptionService");
const router = express.Router();
router.use(authenticateToken);
const validBody = (body, keys) => body && !Array.isArray(body) && typeof body === "object" && Object.keys(body).every((key) => keys.includes(key));
router.get("/me", async (req, res) => {
  const subscription = await service.getSubscription(req.user);
  const pendingPayment = await Order.findOne({ student: req.user._id, paymentType: "subscription", paymentMethod: "stripe", status: "pending" })
    .select("billingCycle status orderReference totalAmount").sort({ createdAt: -1 }).lean();
  return res.json({ ...subscription, pendingPayment });
});
router.post("/upgrade", requireRole("student"), async (req, res) => {
  if (!validBody(req.body, ["billingCycle"]) || !["monthly", "yearly"].includes(req.body.billingCycle)) return res.status(400).json({ message: "Choose monthly or yearly billing" });
  try {
    const result = await checkoutSubscription(req.user._id, req.body.billingCycle);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to start Premium checkout" });
  }
});
router.post("/dev/simulate", (req, res, next) => {
  if (process.env.NODE_ENV !== "development" || process.env.ENABLE_DEV_SUBSCRIPTIONS !== "true") return res.sendStatus(404);
  next();
}, requireRole("admin"), async (req, res) => {
  const { userId, plan, billingCycle } = req.body || {};
  if (!validBody(req.body, ["userId", "plan", "billingCycle"]) || !mongoose.isObjectIdOrHexString(userId) || !["free", "premium"].includes(plan) || (plan === "premium" ? !["monthly", "yearly"].includes(billingCycle) : billingCycle != null)) return res.status(400).json({ message: "Provide a student userId, free or premium plan, and monthly/yearly billing for Premium" });
  const subscription = plan === "premium" ? service.premiumSubscription(billingCycle) : { plan: "free", status: "active", billingCycle: null, startDate: null, endDate: null };
  const user = await User.findOneAndUpdate({ _id: userId, role: "student" }, { $set: { subscription } }, { returnDocument: "after", runValidators: true });
  if (!user) return res.status(404).json({ message: "Student not found" });
  await AdminAudit.create({ admin: req.user._id, action: "Simulated subscription (development)", detail: `${userId}: ${plan}` });
  return res.json(await service.getSubscription(user));
});
module.exports = router;

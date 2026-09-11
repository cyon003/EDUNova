const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Enrollment = require("../models/Enrollment");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { enrollCourses, purchaseTransaction, policyError } = require("../services/enrollmentPolicy");
const router = express.Router();
const courseFields = "name slug thumbnail price";
router.use(authenticateToken, requireRole("student"));

function courseIds(values) {
  if (!Array.isArray(values) || !values.length || values.some(id => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    throw policyError(400, "Provide valid course IDs");
  }
  return [...new Set(values)];
}
function failure(res, error, fallback) {
  if (!error.status) console.error(fallback, error.message);
  return res.status(error.status || 500).json({ message: error.status ? error.message : fallback });
}

async function checkout(studentId, requested, fromCart) {
  return purchaseTransaction(studentId, async (session) => {
    let ids = requested;
    if (fromCart) {
      const cart = await Cart.findOne({ student: studentId }).session(session);
      const inCart = (cart?.items || []).map(item => String(item.course));
      if (!inCart.length) throw policyError(400, "Your cart is empty");
      ids = requested || inCart;
      if (ids.some(id => !inCart.includes(id))) throw policyError(400, "One or more selected courses are not in your cart");
    }
    const owned = await Enrollment.find({ student: studentId, course: { $in: ids } }).session(session);
    const ownedIds = new Set(owned.map(item => String(item.course)));
    ids = ids.filter(id => !ownedIds.has(id));
    if (!ids.length) throw policyError(409, "You are already enrolled in the selected courses");
    const existing = await Order.findOne({ student: studentId, status: { $in: ["pending", "awaiting_verification"] }, "items.course": { $in: ids } }).session(session).populate("items.course", courseFields);
    if (existing) return { status: 200, body: { message: "You already have a pending order for one or more selected courses.", order: existing, existing: true } };
    // Check all policies before creating even a paid order. A pending order does not reserve a seat.
    const courses = await enrollCourses(studentId, ids, session, { create: false });
    const items = courses.map(course => ({ course: course._id, price: Number(course.price ?? 0) }));
    if (items.some(item => !Number.isFinite(item.price) || item.price < 0)) throw policyError(400, "Invalid course price");
    const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
    if (totalAmount === 0) await enrollCourses(studentId, ids, session, { freeOnly: true });
    const [order] = await Order.create([{
      student: studentId, items, totalAmount,
      orderReference: `EDU-${crypto.randomUUID().toUpperCase()}`,
      status: totalAmount === 0 ? "completed" : "pending",
      paymentMethod: totalAmount === 0 ? "free" : "manual_qr",
      paidAt: totalAmount === 0 ? new Date() : null,
    }], { session });
    if (totalAmount === 0) await Cart.updateOne({ student: studentId }, { $pull: { items: { course: { $in: ids } } } }, { session });
    await order.populate("items.course", courseFields);
    return { status: 201, body: {
      message: totalAmount === 0 ? "Free courses purchased successfully." : "Order created. Please complete the QR payment and upload your payment slip.",
      order, enrolledCourses: totalAmount === 0 ? courses.map(course => course.slug) : [],
    } };
  });
}
router.get("/", async (req, res) => {
  try { return res.json(await Order.find({ student: req.user._id }).populate("items.course", courseFields).sort({ createdAt: -1 })); }
  catch (error) { return failure(res, error, "Unable to load orders"); }
});
router.post("/buy-now", async (req, res) => {
  try {
    const result = await checkout(req.user._id, courseIds([req.body?.courseId]), false);
    return res.status(result.status).json(result.body);
  } catch (error) { return failure(res, error, "Buy Now failed"); }
});
router.post("/checkout", async (req, res) => {
  try {
    const ids = req.body?.courseIds === undefined ? undefined : courseIds(req.body.courseIds);
    const result = await checkout(req.user._id, ids, true);
    return res.status(result.status).json(result.body);
  } catch (error) { return failure(res, error, "Checkout failed"); }
});
router.get("/:orderId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) throw policyError(400, "Invalid order ID");
    const order = await Order.findOne({ _id: req.params.orderId, student: req.user._id }).populate("items.course", courseFields);
    if (!order) throw policyError(404, "Order not found");
    return res.json(order);
  } catch (error) { return failure(res, error, "Unable to load order"); }
});
module.exports = router;

const mongoose = require("mongoose");
const stripe = require("./stripePaymentService");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Notification = require("../models/Notification");
const { enrollCourses, purchaseTransaction, policyError } = require("./enrollmentPolicy");
const { activateSubscription } = require("./subscriptionPaymentService");

function validatePayment(order, checkout) {
  if (order.paymentMethod !== "stripe" || order.paymentReference !== checkout.id ||
      String(order._id) !== checkout.metadata?.orderId || String(order.student) !== checkout.metadata?.studentId ||
      checkout.client_reference_id !== String(order._id) || checkout.mode !== "payment" ||
      checkout.currency !== "thb" || !Number.isSafeInteger(checkout.amount_total) ||
      checkout.amount_total !== Math.round(order.totalAmount * 100) || checkout.amount_total <= 0) {
    throw policyError(409, "Stripe payment details do not match this order.");
  }
  if (checkout.payment_status !== "paid" || checkout.status !== "complete") {
    throw policyError(402, "Payment is pending or unsuccessful. Access has not been activated.");
  }
}

async function fulfillCheckout(checkout, studentId) {
  const owner = checkout.metadata?.studentId;
  const orderId = checkout.metadata?.orderId;
  if (!mongoose.isValidObjectId(owner) || !mongoose.isValidObjectId(orderId)) throw policyError(400, "Invalid Stripe order reference.");
  if (studentId && String(studentId) !== owner) throw policyError(403, "This payment does not belong to you.");
  return purchaseTransaction(owner, async (session) => {
    const order = await Order.findOne({ _id: orderId, student: owner }).session(session);
    if (!order) throw policyError(404, "Order not found.");
    // Validate even replays before returning success. The shared student write serializes
    // webhooks and browser verification; all fulfillment effects commit exactly once.
    validatePayment(order, checkout);
    if (order.status === "completed") return { order, alreadyCompleted: true };
    if (order.status !== "pending") throw policyError(409, "Order cannot be completed.");
    order.status = "completed";
    order.paidAt = new Date();
    if (order.paymentType === "subscription") {
      await activateSubscription(order, session, order.paidAt);
    } else {
      const ids = order.items.map(item => item.course);
      if (!ids.length) throw policyError(409, "Order has no courses.");
      await enrollCourses(owner, ids, session, { selfEnrollment: false });
      await Cart.updateOne({ student: owner }, { $pull: { items: { course: { $in: ids } } } }, { session });
    }
    await order.save({ session });
    await Notification.create([{
      user: owner, order: order._id, source: "SYSTEM", type: "system", title: "Payment confirmed",
      message: order.paymentType === "subscription"
        ? `Payment ${order.orderReference} confirmed. Your Premium time has been activated or extended. There is no automatic renewal.`
        : `Payment ${order.orderReference} confirmed. Your course access is now available.`,
    }], { session });
    return { order, alreadyCompleted: false };
  });
}

async function createCheckout(studentId, orderId) {
  return purchaseTransaction(studentId, async (dbSession) => {
    const order = await Order.findOne({ _id: orderId, student: studentId }).session(dbSession);
    if (!order) throw policyError(404, "Order not found.");
    if (order.paymentMethod !== "stripe" || order.status !== "pending" || order.totalAmount <= 0) {
      throw policyError(409, "This order is not available for Stripe payment.");
    }
    if (order.paymentReference) {
      // Never create a second charge after a retrieval failure or while an async
      // payment is processing. Only a confirmed expired session can be replaced.
      const existing = await stripe.checkout.sessions.retrieve(order.paymentReference);
      if (existing.status === "open" && existing.url) return existing;
      if (existing.status !== "expired" && !(order.stripeFailedSession === existing.id && existing.payment_status === "unpaid")) throw policyError(409, "Payment is processing or completed. Check payment status before retrying.");
    }
    const lines = order.paymentType === "subscription"
      ? [{ name: `EDUNova Premium (${order.billingCycle})`, price: order.totalAmount }]
      : order.items.map(item => ({ name: item.name || `EDUNova Course ${item.course}`, price: item.price }));
    const cents = lines.map(item => Math.round(item.price * 100));
    if (!lines.length || cents.some(value => !Number.isSafeInteger(value) || value < 0) ||
        cents.reduce((sum, value) => sum + value, 0) !== Math.round(order.totalAmount * 100)) {
      throw policyError(400, "Invalid order prices.");
    }
    const frontend = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      // Omit payment_method_types: Stripe presents enabled, eligible methods.
      line_items: lines.map((item, index) => ({ price_data: { currency: "thb", product_data: { name: item.name }, unit_amount: cents[index] }, quantity: 1 })),
      success_url: `${frontend}/checkout?orderId=${order._id}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontend}/checkout?orderId=${order._id}&payment=cancelled`,
      client_reference_id: String(order._id),
      metadata: { orderId: String(order._id), studentId: String(studentId), orderReference: order.orderReference },
    }, { idempotencyKey: `checkout:${order._id}:${order.paymentReference || "initial"}` });
    order.paymentReference = checkout.id;
    await order.save({ session: dbSession });
    return checkout;
  });
}
module.exports = { createCheckout, fulfillCheckout, validatePayment };

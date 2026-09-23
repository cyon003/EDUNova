const Order = require("../models/Order");
const stripe = require("../services/stripePaymentService");
const { fulfillCheckout } = require("../services/stripeCheckoutService");
module.exports = async function stripeWebhook(req, res) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ message: "Webhook is not configured." });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).json({ message: "Invalid Stripe signature." }); }
  if (event.type === "checkout.session.async_payment_failed") {
    try {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
      if (session.payment_status === "unpaid") {
        await Order.updateOne({ paymentReference: session.id, paymentMethod: "stripe", status: "pending" }, { $set: { stripeFailedSession: session.id } });
      }
      return res.json({ received: true });
    } catch { return res.status(500).json({ message: "Payment status update will be retried." }); }
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    // Expiry, cancellation and failed asynchronous payments never grant access.
    // Keep the order pending so an expired checkout can be retried safely.
    return res.json({ received: true });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
    if (session.payment_status !== "paid") return res.json({ received: true, pending: true });
    await fulfillCheckout(session);
    return res.json({ received: true });
  } catch {
    // Non-2xx allows Stripe to retry a transient database/fulfillment failure.
    return res.status(500).json({ message: "Payment fulfillment will be retried." });
  }
};

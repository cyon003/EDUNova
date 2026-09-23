const express = require("express");
const mongoose = require("mongoose");
const stripe = require("../services/stripePaymentService");
const { createCheckout, fulfillCheckout } = require("../services/stripeCheckoutService");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const router = express.Router();
router.use(authenticateToken, requireRole("student"));
function failure(res, error) {
  return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to process Stripe payment. Please retry." });
}
router.post("/create-checkout-session", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body?.orderId)) return res.status(400).json({ message: "Invalid order ID." });
    const session = await createCheckout(req.user._id, req.body.orderId);
    return res.json({ success: true, checkoutUrl: session.url, sessionId: session.id });
  } catch (error) { return failure(res, error); }
});
router.post("/verify-session", async (req, res) => {
  try {
    if (typeof req.body?.sessionId !== "string" || !/^cs_[\w]+$/.test(req.body.sessionId)) return res.status(400).json({ message: "Invalid Stripe session ID." });
    const session = await stripe.checkout.sessions.retrieve(req.body.sessionId);
    const result = await fulfillCheckout(session, req.user._id);
    await result.order.populate("items.course", "name slug thumbnail price");
    return res.json({ success: true, paid: true, ...result });
  } catch (error) { return failure(res, error); }
});
module.exports = router;

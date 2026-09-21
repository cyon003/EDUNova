const express = require("express");
const mongoose = require("mongoose");
const stripe = require("../services/stripePaymentService");

const Order = require("../models/Order");
const Cart = require("../models/Cart");

const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  enrollCourses,
  purchaseTransaction,
  policyError,
} = require("../services/enrollmentPolicy");

const router = express.Router();

router.use(authenticateToken, requireRole("student"));

const FRONTEND_URL = (
  process.env.FRONTEND_URL || "http://localhost:5173"
).replace(/\/$/, "");

const courseFields = "name slug thumbnail price";

/*
 * Create Stripe Checkout Session
 *
 * POST /api/stripe/create-checkout-session
 */
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { orderId } = req.body || {};

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      student: req.user._id,
    }).populate("items.course", courseFields);

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (order.status === "completed") {
      return res.status(409).json({
        message: "This order has already been paid.",
      });
    }

    if (order.status !== "pending") {
      return res.status(409).json({
        message: "This order is not available for payment.",
      });
    }

    if (order.paymentType !== "course") {
      return res.status(400).json({
        message: "This checkout session is only for course purchases.",
      });
    }

    if (Number(order.totalAmount) <= 0) {
      return res.status(400).json({
        message: "Free courses do not require Stripe payment.",
      });
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({
        message: "This order contains no courses.",
      });
    }

    /*
     * Reuse an existing Stripe Checkout Session if possible.
     */
    if (order.paymentMethod === "stripe" && order.paymentReference) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          order.paymentReference
        );

        if (
          existingSession &&
          existingSession.status !== "expired" &&
          existingSession.url
        ) {
          return res.json({
            success: true,
            checkoutUrl: existingSession.url,
            sessionId: existingSession.id,
          });
        }
      } catch (stripeError) {
        console.warn(
          "Existing Stripe session could not be reused:",
          stripeError.message
        );
      }
    }

    const lineItems = order.items.map((item) => ({
      price_data: {
        currency: "thb",
        product_data: {
          name: item.course?.name || "EDUNova Course",
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: 1,
    }));

    if (
      lineItems.some(
        (item) =>
          !Number.isInteger(item.price_data.unit_amount) ||
          item.price_data.unit_amount <= 0
      )
    ) {
      return res.status(400).json({
        message: "Invalid order price.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: lineItems,

      success_url:
        `${FRONTEND_URL}/checkout?orderId=${encodeURIComponent(
          String(order._id)
        )}&payment=success&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${FRONTEND_URL}/checkout?orderId=${encodeURIComponent(
          String(order._id)
        )}&payment=cancelled`,

      client_reference_id: String(order._id),

      metadata: {
        orderId: String(order._id),
        studentId: String(req.user._id),
        orderReference: order.orderReference,
      },
    });

    order.paymentMethod = "stripe";
    order.paymentReference = session.id;

    await order.save();

    return res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error(
      "Create Stripe checkout session error:",
      error
    );

    return res.status(error.status === 503 ? 503 : 500).json({
      message: "Unable to create Stripe checkout session.",
    });
  }
});

/*
 * Verify Stripe Checkout Session
 *
 * POST /api/stripe/verify-session
 *
 * The frontend cannot simply tell us that payment succeeded.
 * The backend retrieves the Checkout Session directly from Stripe
 * and verifies the actual payment status.
 */
router.post("/verify-session", async (req, res) => {
  try {
    const { sessionId } = req.body || {};

    if (
      typeof sessionId !== "string" ||
      !sessionId.trim() ||
      !sessionId.startsWith("cs_")
    ) {
      return res.status(400).json({
        message: "Invalid Stripe session ID.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(
      sessionId
    );

    if (!session) {
      return res.status(404).json({
        message: "Stripe Checkout Session not found.",
      });
    }

    /*
     * Make sure this Stripe payment belongs to the
     * currently authenticated EDUNova student.
     */
    if (
      session.metadata?.studentId !== String(req.user._id)
    ) {
      return res.status(403).json({
        message: "This payment session does not belong to you.",
      });
    }

    const orderId = session.metadata?.orderId;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        message: "Stripe session has an invalid order reference.",
      });
    }

    /*
     * Stripe must confirm that the Checkout Session
     * has actually been paid.
     */
    if (session.payment_status !== "paid") {
      return res.status(402).json({
        success: false,
        paid: false,
        message:
          "Stripe has not confirmed this payment as paid.",
      });
    }

    if (session.status !== "complete") {
      return res.status(402).json({
        success: false,
        paid: false,
        message:
          "Stripe Checkout has not been completed.",
      });
    }

    /*
     * Complete the order and enrollment inside the existing
     * MongoDB transaction system.
     */
    const result = await purchaseTransaction(
      req.user._id,
      async (dbSession) => {
        const order = await Order.findOne({
          _id: orderId,
          student: req.user._id,
        })
          .session(dbSession)
          .populate("items.course", courseFields);

        if (!order) {
          throw policyError(404, "Order not found.");
        }

        /*
         * Idempotency:
         * If this order was already completed, do not enroll
         * the student again.
         */
        if (order.status === "completed") {
          return {
            alreadyCompleted: true,
            order,
          };
        }

        if (order.status !== "pending") {
          throw policyError(
            409,
            "This order is not available for completion."
          );
        }

        /*
         * Make sure the Stripe session belongs to this order.
         */
        if (order.paymentReference !== session.id) {
          throw policyError(
            409,
            "Stripe payment session does not match this order."
          );
        }

        /*
         * Verify the amount paid against the server-side
         * order amount.
         */
        const expectedAmount = Math.round(
          Number(order.totalAmount) * 100
        );

        if (
          !Number.isInteger(session.amount_total) ||
          session.amount_total !== expectedAmount
        ) {
          throw policyError(
            409,
            "Stripe payment amount does not match the order."
          );
        }

        const courseIds = order.items.map((item) =>
          String(item.course?._id || item.course)
        );

        /*
         * Use EDUNova's existing enrollment policy.
         */
        await enrollCourses(
          req.user._id,
          courseIds,
          dbSession,
          {
            create: true,
            freeOnly: false,
          }
        );

        order.status = "completed";
        order.paymentMethod = "stripe";
        order.paymentReference = session.id;
        order.paidAt = new Date();

        await order.save({
          session: dbSession,
        });

        /*
         * Remove the purchased courses from the student's cart.
         */
        await Cart.updateOne(
          {
            student: req.user._id,
          },
          {
            $pull: {
              items: {
                course: {
                  $in: courseIds,
                },
              },
            },
          },
          {
            session: dbSession,
          }
        );

        return {
          alreadyCompleted: false,
          order,
        };
      }
    );

    const populatedOrder = await Order.findById(
      result.order._id
    ).populate("items.course", courseFields);

    return res.json({
      success: true,
      paid: true,
      alreadyCompleted: result.alreadyCompleted,
      message: result.alreadyCompleted
        ? "Payment was already verified."
        : "Payment verified and course enrollment completed.",
      order: populatedOrder,
    });
  } catch (error) {
    console.error(
      "Verify Stripe payment error:",
      error
    );

    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Unable to verify Stripe payment.",
    });
  }
});

module.exports = router;
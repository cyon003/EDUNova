const express = require("express");

const Cart = require("../models/Cart");
const Course = require("../models/Course");
const Order = require("../models/Order");
const Enrollment = require("../models/Enrollment");
const Notification = require("../models/Notification");

const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const { issueOtp, verifyOtp } = require("../utils/otpService");

const router = express.Router();

// All checkout routes require a logged-in student
router.use(authenticateToken);
router.use(requireRole("student"));

// ─────────────────────────────────────────────────────────────
// POST /api/checkout/send-otp
// Validates the cart has items, then sends OTP to the given email
// ─────────────────────────────────────────────────────────────

router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ message: "A valid email address is required" });
    }

    // Make sure the cart is not empty before sending OTP
    const cart = await Cart.findOne({ student: req.user._id }).populate(
      "items.course",
      "moderationStatus price"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    const validItems = cart.items.filter(
      (item) => item.course && item.course.moderationStatus === "published"
    );

    if (validItems.length === 0) {
      return res
        .status(400)
        .json({ message: "No published courses in your cart" });
    }

    // Issue and send OTP
    const result = await issueOtp(email);

    // Always return 200 for security — don't reveal if email failed
    return res.json({
      message: "If the email is valid, a verification code has been sent.",
      sent: result.sent,

      // Only expose delivery failure in development
      ...(process.env.NODE_ENV === "development" && !result.sent
        ? { devNote: result.reason || result.errorType }
        : {}),
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res
      .status(500)
      .json({ message: "Unable to send verification code" });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/checkout/verify-and-pay
// Verifies OTP then runs the full checkout
// ─────────────────────────────────────────────────────────────

router.post("/verify-and-pay", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email and OTP are required" });
    }

    // 1. Verify OTP
    const verification = verifyOtp(email, otp);

    if (!verification.valid) {
      return res.status(400).json({ message: verification.reason });
    }

    // 2. Load cart
    const cart = await Cart.findOne({ student: req.user._id }).populate(
      "items.course",
      "name slug price moderationStatus tutor"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    // 3. Filter published courses only
    const validItems = cart.items.filter(
      (item) => item.course && item.course.moderationStatus === "published"
    );

    if (validItems.length === 0) {
      return res
        .status(400)
        .json({ message: "No published courses in cart" });
    }

    // 4. Remove already-enrolled courses
    const courseIds = validItems.map((item) => item.course._id);

    const existingEnrollments = await Enrollment.find({
      student: req.user._id,
      course: { $in: courseIds },
    }).select("course");

    const alreadyEnrolledIds = new Set(
      existingEnrollments.map((e) => String(e.course))
    );

    const purchasableItems = validItems.filter(
      (item) => !alreadyEnrolledIds.has(String(item.course._id))
    );

    if (purchasableItems.length === 0) {
      return res.status(409).json({
        message: "You are already enrolled in all cart courses",
      });
    }

    // 5. Build order items using server-side prices only
    const orderItems = purchasableItems.map((item) => ({
      course: item.course._id,
      price: item.course.price || 0,
    }));

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.price,
      0
    );

    // 6. Create pending order
    const order = await Order.create({
      student: req.user._id,
      items: orderItems,
      totalAmount,
      status: "pending",
      paymentMethod: totalAmount === 0 ? "free" : "mock",
      paymentReference:
        totalAmount === 0 ? "FREE" : `OTP-VERIFIED-${Date.now()}`,
    });

    // 7. Mark order complete
    // OTP verified = payment authorized
    order.status = "completed";
    order.paidAt = new Date();

    await order.save();

    // 8. Create enrollments
    const enrollmentDocs = purchasableItems.map((item) => ({
      student: req.user._id,
      course: item.course._id,
      completedLessons: [],
      recentActivity: [],
    }));

    await Enrollment.insertMany(enrollmentDocs, { ordered: false });

    // 9. Clear purchased items from cart
    const purchasedIds = new Set(
      purchasableItems.map((item) => String(item.course._id))
    );

    cart.items = cart.items.filter(
      (item) =>
        !purchasedIds.has(String(item.course._id || item.course))
    );

    await cart.save();

    // 10. Send purchase notification
    await Notification.create({
      user: req.user._id,
      source: "SYSTEM",
      title: "Purchase Successful",
      message: `You have successfully enrolled in ${
        purchasableItems.length
      } course${purchasableItems.length > 1 ? "s" : ""}.`,
    });

    // 11. Populate order before returning it
    const populated = await order.populate(
      "items.course",
      "name slug thumbnail price"
    );

    return res.status(201).json({
      message: "Payment successful",
      order: populated,
      enrolledCourses: purchasableItems.map(
        (item) => item.course.slug
      ),
    });
  } catch (error) {
    console.error("Checkout error:", error);

    return res.status(500).json({
      message: "Checkout failed",
      error: error.message,
    });
  }
});

module.exports = router;
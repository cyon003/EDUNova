const express = require("express");
const Cart = require("../models/Cart");
const Course = require("../models/Course");
const Order = require("../models/Order");
const Enrollment = require("../models/Enrollment");
const Notification = require("../models/Notification");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole("student"));

// GET /api/orders — get all orders for the current student
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({ student: req.user._id })
      .populate("items.course", "name slug thumbnail price")
      .sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load orders", error: error.message });
  }
});

// POST /api/orders/checkout — create order from current cart and process payment
router.post("/checkout", async (req, res) => {
  try {
    // 1. Load cart
    const cart = await Cart.findOne({ student: req.user._id })
      .populate("items.course", "name slug price moderationStatus tutor");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    // 2. Filter to only published courses
    const validItems = cart.items.filter(
      (item) => item.course && item.course.moderationStatus === "published"
    );
    if (validItems.length === 0) {
      return res.status(400).json({ message: "No published courses in cart" });
    }

    // 3. Check none are already enrolled
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
      return res.status(409).json({ message: "You are already enrolled in all cart courses" });
    }

    // 4. Calculate total
    const orderItems = purchasableItems.map((item) => ({
      course: item.course._id,
      price: item.course.price || 0,
    }));
    const totalAmount = orderItems.reduce((sum, item) => sum + item.price, 0);

    // 5. Create order record (pending)
    const order = await Order.create({
      student: req.user._id,
      items: orderItems,
      totalAmount,
      status: "pending",
      paymentMethod: totalAmount === 0 ? "free" : "mock",
    });

    // 6. Process payment
    // — Free courses: complete immediately
    // — Paid courses: mock success (replace this block with real Stripe later)
    let paymentSuccess = false;
    if (totalAmount === 0) {
      paymentSuccess = true;
    } else {
      // Mock payment — always succeeds for now
      // TODO: replace with Stripe PaymentIntent
      paymentSuccess = true;
      order.paymentReference = `MOCK-${Date.now()}`;
    }

    if (!paymentSuccess) {
      order.status = "failed";
      await order.save();
      return res.status(402).json({ message: "Payment failed", orderId: order._id });
    }

    // 7. Mark order complete
    order.status = "completed";
    order.paidAt = new Date();
    await order.save();

    // 8. Create enrollments for each purchased course
    const enrollmentDocs = purchasableItems.map((item) => ({
      student: req.user._id,
      course: item.course._id,
      completedLessons: [],
      recentActivity: [],
    }));
    await Enrollment.insertMany(enrollmentDocs, { ordered: false });

    // 9. Clear cart items that were purchased
    const purchasedIds = new Set(purchasableItems.map((item) => String(item.course._id)));
    cart.items = cart.items.filter(
      (item) => !purchasedIds.has(String(item.course))
    );
    await cart.save();

    // 10. Send notification to student
    await Notification.create({
      user: req.user._id,
      source: "SYSTEM",
      title: "Purchase Successful",
      message: `You have successfully enrolled in ${purchasableItems.length} course${purchasableItems.length > 1 ? "s" : ""}.`,
    });

    const populated = await order.populate("items.course", "name slug thumbnail price");
    return res.status(201).json({
      message: "Purchase successful",
      order: populated,
      enrolledCourses: purchasableItems.map((item) => item.course.slug),
    });
  } catch (error) {
    return res.status(500).json({ message: "Checkout failed", error: error.message });
  }
});

// GET /api/orders/:orderId — get a single order
router.get("/:orderId", async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      student: req.user._id,
    }).populate("items.course", "name slug thumbnail price");

    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load order", error: error.message });
  }
});

module.exports = router;

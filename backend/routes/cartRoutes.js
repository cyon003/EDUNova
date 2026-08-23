const express = require("express");
const Cart = require("../models/Cart");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

// All cart routes require a logged-in student
router.use(authenticateToken);
router.use(requireRole("student"));

// GET /api/cart — get current student's cart
router.get("/", async (req, res) => {
  try {
    const cart = await Cart.findOne({ student: req.user._id })
      .populate("items.course", "name slug thumbnail price tutor level category moderationStatus");

    if (!cart) return res.json({ items: [], total: 0 });

    // Filter out any courses that are no longer published
    const validItems = cart.items.filter(
      (item) => item.course && item.course.moderationStatus === "published"
    );

    const total = validItems.reduce((sum, item) => sum + (item.course.price || 0), 0);

    return res.json({ items: validItems, total });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load cart", error: error.message });
  }
});

// POST /api/cart — add a course to cart
router.post("/", async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ message: "courseId is required" });

    // Check course exists and is published
    const course = await Course.findById(courseId).select("moderationStatus price slug");
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.moderationStatus !== "published") {
      return res.status(400).json({ message: "Course is not available" });
    }

    // Check student is not already enrolled
    const alreadyEnrolled = await Enrollment.exists({
      student: req.user._id,
      course: courseId,
    });
    if (alreadyEnrolled) {
      return res.status(409).json({ message: "You are already enrolled in this course" });
    }

    // Get or create cart
    let cart = await Cart.findOne({ student: req.user._id });
    if (!cart) {
      cart = new Cart({ student: req.user._id, items: [] });
    }

    // Check not already in cart
    const alreadyInCart = cart.items.some(
      (item) => String(item.course) === String(courseId)
    );
    if (alreadyInCart) {
      return res.status(409).json({ message: "Course is already in your cart" });
    }

    cart.items.push({ course: courseId });
    await cart.save();

    await cart.populate("items.course", "name slug thumbnail price level category");
    const total = cart.items.reduce((sum, item) => sum + (item.course?.price || 0), 0);

    return res.status(201).json({ items: cart.items, total });
  } catch (error) {
    return res.status(500).json({ message: "Unable to add to cart", error: error.message });
  }
});

// DELETE /api/cart/:courseId — remove a course from cart
router.delete("/:courseId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ student: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const before = cart.items.length;
    cart.items = cart.items.filter(
      (item) => String(item.course) !== String(req.params.courseId)
    );

    if (cart.items.length === before) {
      return res.status(404).json({ message: "Course not found in cart" });
    }

    await cart.save();
    await cart.populate("items.course", "name slug thumbnail price level category");
    const total = cart.items.reduce((sum, item) => sum + (item.course?.price || 0), 0);

    return res.json({ items: cart.items, total });
  } catch (error) {
    return res.status(500).json({ message: "Unable to remove from cart", error: error.message });
  }
});

// DELETE /api/cart — clear entire cart
router.delete("/", async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { student: req.user._id },
      { $set: { items: [] } }
    );
    return res.json({ items: [], total: 0 });
  } catch (error) {
    return res.status(500).json({ message: "Unable to clear cart", error: error.message });
  }
});

module.exports = router;

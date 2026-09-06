const express = require("express");
const crypto = require("crypto");

const Cart = require("../models/Cart");
const Course = require("../models/Course");
const Order = require("../models/Order");
const Enrollment = require("../models/Enrollment");

const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole("student"));

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function generateOrderReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `EDU-${timestamp}-${random}`;
}

function normalizeCourseIds(courseIds) {
  if (!Array.isArray(courseIds)) {
    return [];
  }

  return [
    ...new Set(
      courseIds
        .map((id) => String(id).trim())
        .filter(Boolean)
    ),
  ];
}

async function getPendingOrderForCourses(studentId, courseIds) {
  const requestedIds = new Set(
    courseIds.map((id) => String(id))
  );

  const pendingOrders = await Order.find({
    student: studentId,
    status: {
      $in: ["pending", "awaiting_verification"],
    },
  }).populate(
    "items.course",
    "name slug thumbnail price"
  );

  for (const order of pendingOrders) {
    const existingIds = order.items
      .map((item) =>
        String(item.course?._id || item.course)
      );

    const hasOverlap = existingIds.some((id) =>
      requestedIds.has(id)
    );

    if (hasOverlap) {
      return order;
    }
  }

  return null;
}

async function enrollFreeCourses(studentId, items) {
  if (!items.length) {
    return;
  }

  await Enrollment.bulkWrite(
    items.map((item) => ({
      updateOne: {
        filter: {
          student: studentId,
          course: item.course._id,
        },
        update: {
          $setOnInsert: {
            student: studentId,
            course: item.course._id,
            completedLessons: [],
            completedMissions: [],
            recentActivity: [],
          },
        },
        upsert: true,
      },
    }))
  );
}

// --------------------------------------------------
// GET /api/orders
// Get all orders belonging to current student.
// --------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({
      student: req.user._id,
    })
      .populate(
        "items.course",
        "name slug thumbnail price"
      )
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (error) {
    console.error("Load orders error:", error);

    return res.status(500).json({
      message: "Unable to load orders",
      error: error.message,
    });
  }
});

// --------------------------------------------------
// POST /api/orders/buy-now
//
// Direct purchase of ONE course.
//
// IMPORTANT:
// - Does NOT add the course to cart.
// - Price comes from database.
// - Does NOT enroll paid courses.
// - Creates a pending manual QR order.
// --------------------------------------------------

router.post("/buy-now", async (req, res) => {
  try {
    const courseId = String(
      req.body?.courseId || ""
    ).trim();

    if (!courseId) {
      return res.status(400).json({
        message: "Course ID is required",
      });
    }

    // ----------------------------------------------
    // 1. Load course directly from database
    // ----------------------------------------------

    const course = await Course.findOne({
      _id: courseId,
      moderationStatus: "published",
    }).select(
      "name slug thumbnail price moderationStatus tutor"
    );

    if (!course) {
      return res.status(404).json({
        message: "Course not found or unavailable",
      });
    }

    // ----------------------------------------------
    // 2. Prevent buying an already-owned course
    // ----------------------------------------------

    const existingEnrollment =
      await Enrollment.findOne({
        student: req.user._id,
        course: course._id,
      });

    if (existingEnrollment) {
      return res.status(409).json({
        message: "You are already enrolled in this course",
      });
    }

    // ----------------------------------------------
    // 3. Prevent duplicate pending orders
    // ----------------------------------------------

    const existingOrder =
      await getPendingOrderForCourses(
        req.user._id,
        [course._id]
      );

    if (existingOrder) {
      return res.status(200).json({
        message:
          "You already have a pending order for this course.",
        order: existingOrder,
        existing: true,
      });
    }

    // ----------------------------------------------
    // 4. Price MUST come from database
    // ----------------------------------------------

    const price = Number(course.price || 0);

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        message: "Invalid course price",
      });
    }

    const orderReference =
      generateOrderReference();

    // ----------------------------------------------
    // 5. Create order
    // ----------------------------------------------

    const order = await Order.create({
      student: req.user._id,

      items: [
        {
          course: course._id,
          price,
        },
      ],

      totalAmount: price,
      orderReference,

      status:
        price === 0
          ? "completed"
          : "pending",

      paymentMethod:
        price === 0
          ? "free"
          : "manual_qr",

      paymentReference: "",

      paidAt:
        price === 0
          ? new Date()
          : null,
    });

    // ----------------------------------------------
    // 6. Free course
    // ----------------------------------------------

    if (price === 0) {
      await enrollFreeCourses(
        req.user._id,
        [
          {
            course,
          },
        ]
      );
    }

    // ----------------------------------------------
    // 7. Return populated order
    // ----------------------------------------------

    const populatedOrder =
      await order.populate(
        "items.course",
        "name slug thumbnail price"
      );

    return res.status(201).json({
      message:
        price === 0
          ? "Free course purchased successfully."
          : "Order created. Please complete the QR payment and upload your payment slip.",

      order: populatedOrder,

      enrolledCourses:
        price === 0
          ? [course.slug]
          : [],
    });
  } catch (error) {
    console.error("Buy now error:", error);

    return res.status(500).json({
      message: "Buy Now failed",
      error: error.message,
    });
  }
});

// --------------------------------------------------
// POST /api/orders/checkout
//
// Cart checkout.
//
// Body:
// {
//   courseIds: ["courseId1", "courseId2"]
// }
//
// If courseIds is omitted, all cart courses are used
// for backwards compatibility.
// --------------------------------------------------

router.post("/checkout", async (req, res) => {
  try {
    // ----------------------------------------------
    // 1. Load student's cart
    // ----------------------------------------------

    const cart = await Cart.findOne({
      student: req.user._id,
    }).populate(
      "items.course",
      "name slug thumbnail price moderationStatus tutor"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Your cart is empty",
      });
    }

    // ----------------------------------------------
    // 2. Determine selected courses
    // ----------------------------------------------

    const requestedCourseIds =
      normalizeCourseIds(
        req.body?.courseIds
      );

    let selectedItems;

    if (requestedCourseIds.length > 0) {
      const requestedSet = new Set(
        requestedCourseIds
      );

      selectedItems = cart.items.filter(
        (item) =>
          item.course &&
          requestedSet.has(
            String(item.course._id)
          )
      );

      if (
        selectedItems.length !==
        requestedCourseIds.length
      ) {
        return res.status(400).json({
          message:
            "One or more selected courses are not in your cart.",
        });
      }
    } else {
      selectedItems = cart.items.filter(
        (item) => item.course
      );
    }

    if (selectedItems.length === 0) {
      return res.status(400).json({
        message:
          "Please select at least one course.",
      });
    }

    // ----------------------------------------------
    // 3. Only published courses
    // ----------------------------------------------

    const validItems = selectedItems.filter(
      (item) =>
        item.course &&
        item.course.moderationStatus ===
          "published"
    );

    if (validItems.length !== selectedItems.length) {
      return res.status(400).json({
        message:
          "One or more selected courses are no longer available.",
      });
    }

    // ----------------------------------------------
    // 4. Remove already-enrolled courses
    // ----------------------------------------------

    const courseIds = validItems.map(
      (item) => item.course._id
    );

    const existingEnrollments =
      await Enrollment.find({
        student: req.user._id,
        course: {
          $in: courseIds,
        },
      }).select("course");

    const alreadyEnrolledIds =
      new Set(
        existingEnrollments.map(
          (enrollment) =>
            String(enrollment.course)
        )
      );

    const purchasableItems =
      validItems.filter(
        (item) =>
          !alreadyEnrolledIds.has(
            String(item.course._id)
          )
      );

    if (purchasableItems.length === 0) {
      return res.status(409).json({
        message:
          "You are already enrolled in all selected courses.",
      });
    }

    // ----------------------------------------------
    // 5. Get prices FROM DATABASE
    // ----------------------------------------------

    const orderItems =
      purchasableItems.map((item) => ({
        course: item.course._id,
        price: Number(
          item.course.price || 0
        ),
      }));

    const invalidPrice =
      orderItems.some(
        (item) =>
          !Number.isFinite(item.price) ||
          item.price < 0
      );

    if (invalidPrice) {
      return res.status(400).json({
        message:
          "One or more courses have an invalid price.",
      });
    }

    const totalAmount =
      orderItems.reduce(
        (sum, item) =>
          sum + item.price,
        0
      );

    // ----------------------------------------------
    // 6. Prevent duplicate pending orders
    // ----------------------------------------------

    const purchasableCourseIds =
      purchasableItems.map(
        (item) =>
          item.course._id
      );

    const existingOrder =
      await getPendingOrderForCourses(
        req.user._id,
        purchasableCourseIds
      );

    if (existingOrder) {
      return res.status(200).json({
        message:
          "You already have a pending order for one or more selected courses.",
        order: existingOrder,
        existing: true,
      });
    }

    // ----------------------------------------------
    // 7. Create order
    // ----------------------------------------------

    const orderReference =
      generateOrderReference();

    const order = await Order.create({
      student: req.user._id,

      items: orderItems,

      totalAmount,

      orderReference,

      status:
        totalAmount === 0
          ? "completed"
          : "pending",

      paymentMethod:
        totalAmount === 0
          ? "free"
          : "manual_qr",

      paymentReference: "",

      paidAt:
        totalAmount === 0
          ? new Date()
          : null,
    });

    // ----------------------------------------------
    // 8. Free courses
    // ----------------------------------------------

    if (totalAmount === 0) {
      await enrollFreeCourses(
        req.user._id,
        purchasableItems
      );

      const purchasedIds =
        new Set(
          purchasableItems.map(
            (item) =>
              String(item.course._id)
          )
        );

      cart.items =
        cart.items.filter(
          (item) =>
            !purchasedIds.has(
              String(
                item.course?._id ||
                  item.course
              )
            )
        );

      await cart.save();
    }

    // ----------------------------------------------
    // 9. Return populated order
    // ----------------------------------------------

    const populatedOrder =
      await order.populate(
        "items.course",
        "name slug thumbnail price"
      );

    return res.status(201).json({
      message:
        totalAmount === 0
          ? "Free courses purchased successfully."
          : "Order created. Please complete the QR payment and upload your payment slip.",

      order: populatedOrder,

      enrolledCourses:
        totalAmount === 0
          ? purchasableItems.map(
              (item) =>
                item.course.slug
            )
          : [],
    });
  } catch (error) {
    console.error(
      "Create checkout order error:",
      error
    );

    return res.status(500).json({
      message: "Checkout failed",
      error: error.message,
    });
  }
});

// --------------------------------------------------
// GET /api/orders/:orderId
// Get one order belonging to current student.
// --------------------------------------------------

router.get("/:orderId", async (req, res) => {
  try {
    const order =
      await Order.findOne({
        _id: req.params.orderId,
        student: req.user._id,
      }).populate(
        "items.course",
        "name slug thumbnail price"
      );

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    return res.json(order);
  } catch (error) {
    console.error(
      "Load order error:",
      error
    );

    return res.status(500).json({
      message: "Unable to load order",
      error: error.message,
    });
  }
});

module.exports = router;
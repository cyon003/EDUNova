const express = require("express");
const fs = require("fs");
const path = require("path");
const { uploadDirectory } = require("../config/storage");

const Order = require("../models/Order");
const Enrollment = require("../models/Enrollment");
const Cart = require("../models/Cart");

const authenticateToken = require("../middleware/authMiddleware");
const {
  notifyPaymentApproved,
  notifyPaymentRejected,
} = require("../services/notificationService");

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }

  next();
};

const adminMiddleware = [authenticateToken, requireAdmin];

const paymentSlipDirectory = uploadDirectory("payment-slips");

/*
|--------------------------------------------------------------------------
| GET ALL PAYMENT VERIFICATION ORDERS
|--------------------------------------------------------------------------
*/
router.get("/", ...adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({
      status: "awaiting_verification",
    })
      .populate("student", "name email")
      .populate("items.course", "name slug price")
      .sort({ submittedAt: 1 });

    return res.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Get payment verification orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load payment verification orders.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET SINGLE ORDER
|--------------------------------------------------------------------------
*/
router.get("/:orderId", ...adminMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("student", "name email")
      .populate("items.course", "name slug price");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get payment verification order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load order.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| VIEW PAYMENT SLIP
|--------------------------------------------------------------------------
*/
router.get("/:orderId/slip", ...adminMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (!order.paymentSlip?.storedName) {
      return res.status(404).json({
        success: false,
        message: "Payment slip not found.",
      });
    }

    const filePath = path.join(
      paymentSlipDirectory,
      order.paymentSlip.storedName
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Payment slip file not found.",
      });
    }

    res.setHeader(
      "Content-Type",
      order.paymentSlip.mimeType || "application/octet-stream"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(
        order.paymentSlip.originalName || "payment-slip"
      )}"`
    );

    return res.sendFile(filePath);
  } catch (error) {
    console.error("View payment slip error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load payment slip.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| APPROVE PAYMENT
|--------------------------------------------------------------------------
*/
router.post("/:orderId/approve", ...adminMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("items.course", "name slug price");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.status !== "awaiting_verification") {
      return res.status(400).json({
        success: false,
        message: `This order cannot be approved because its status is "${order.status}".`,
      });
    }

    if (!order.paymentSlip?.storedName) {
      return res.status(400).json({
        success: false,
        message: "This order does not have a payment slip.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Create enrollments
    |--------------------------------------------------------------------------
    */
    for (const item of order.items) {
      if (!item.course) {
        continue;
      }

      await Enrollment.findOneAndUpdate(
        {
          student: order.student,
          course: item.course._id,
        },
        {
          $setOnInsert: {
            student: order.student,
            course: item.course._id,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Remove approved courses from cart
    |--------------------------------------------------------------------------
    */
    const courseIds = order.items
      .filter((item) => item.course)
      .map((item) => item.course._id);

    if (courseIds.length > 0) {
      await Cart.updateOne(
        { student: order.student },
        {
          $pull: {
            items: {
              course: { $in: courseIds },
            },
          },
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Mark order completed
    |--------------------------------------------------------------------------
    */
    order.status = "completed";
    order.verifiedAt = new Date();
    order.verifiedBy = req.user.id;
    order.paidAt = new Date();
    order.rejectionReason = "";

    await order.save();

    /*
    |--------------------------------------------------------------------------
    | Notification
    |--------------------------------------------------------------------------
    */
    const courseNames = order.items
      .filter((item) => item.course)
      .map((item) => item.course.name)
      .join(", ");

    await notifyPaymentApproved({
      user: order.student,
      order: order,
      orderReference: order.orderReference,
      courseNames,
    });

    /*
    |--------------------------------------------------------------------------
    | Return updated order
    |--------------------------------------------------------------------------
    */
    const updatedOrder = await Order.findById(order._id)
      .populate("student", "name email")
      .populate("items.course", "name slug price");

    return res.json({
      success: true,
      message: "Payment approved successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Approve payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve payment.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| REJECT PAYMENT
|--------------------------------------------------------------------------
*/
router.post("/:orderId/reject", ...adminMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.status !== "awaiting_verification") {
      return res.status(400).json({
        success: false,
        message: `This order cannot be rejected because its status is "${order.status}".`,
      });
    }

    const reason =
      typeof req.body?.reason === "string"
        ? req.body.reason.trim()
        : "";

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required.",
      });
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason cannot exceed 1000 characters.",
      });
    }

    order.status = "rejected";
    order.rejectionReason = reason;
    order.verifiedAt = new Date();
    order.verifiedBy = req.user.id;

    await order.save();

    await notifyPaymentRejected({
      user: order.student,
      order: order,
      orderReference: order.orderReference,
      reason,
    });

    const updatedOrder = await Order.findById(order._id)
      .populate("student", "name email")
      .populate("items.course", "name slug price");

    return res.json({
      success: true,
      message: "Payment rejected.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Reject payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject payment.",
    });
  }
});

module.exports = router;

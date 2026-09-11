const mongoose = require("mongoose");
const AdminAudit = require("../models/AdminAudit");
const Notification = require("../models/Notification");
const { enrollCourses, purchaseTransaction, policyError } = require("../services/enrollmentPolicy");
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
async function verifyPayment(req, res, approve) {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) throw policyError(400, "Invalid order ID");
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!approve && (!reason || reason.length > 1000)) throw policyError(400, "Provide a rejection reason of 1 to 1000 characters");
    const initial = await Order.findById(req.params.orderId);
    if (!initial) throw policyError(404, "Order not found");
    const order = await purchaseTransaction(initial.student, async (session) => {
      // Compare-and-set and all related writes commit together. Competing decisions retry.
      const updated = await Order.findOneAndUpdate(
        { _id: initial._id, status: "awaiting_verification" },
        { $set: { status: approve ? "completed" : "rejected", verifiedAt: new Date(), verifiedBy: req.user._id, rejectionReason: approve ? "" : reason, ...(approve ? { paidAt: new Date() } : {}) } },
        { new: true, session }
      );
      if (!updated) throw policyError(409, "This order has already been processed or is not awaiting verification");
      if (!updated.paymentSlip?.storedName) throw policyError(400, "This order does not have a payment slip");
      if (approve) {
        // Admin verification can complete an existing purchase when self-enrollment is off,
        // but still cannot exceed capacity or enroll an unpublished/deleted course.
        const ids = updated.items.map(item => item.course);
        await enrollCourses(updated.student, ids, session, { selfEnrollment: false });
        await Cart.updateOne({ student: updated.student }, { $pull: { items: { course: { $in: ids } } } }, { session });
      }
      await Notification.create([{
        user: updated.student, order: updated._id, source: "ADMIN", type: "system",
        title: approve ? "Payment Approved" : "Payment Rejected",
        message: approve ? `Order ${updated.orderReference} is completed and your course access is now available.` : `Order ${updated.orderReference} was rejected. Reason: ${reason}. You can upload a new payment slip.`,
      }], { session });
      await AdminAudit.create([{ admin: req.user._id, action: approve ? "Approved payment" : "Rejected payment", detail: updated.orderReference }], { session });
      await updated.populate("student", "name email");
      await updated.populate("items.course", "name slug price");
      return updated;
    });
    return res.json({ success: true, message: approve ? "Payment approved successfully." : "Payment rejected.", order });
  } catch (error) {
    console.error("Payment verification failed:", error.message);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to verify payment. No payment changes were committed." });
  }
}
router.post("/:orderId/approve", ...adminMiddleware, (req, res) => verifyPayment(req, res, true));
router.post("/:orderId/reject", ...adminMiddleware, (req, res) => verifyPayment(req, res, false));
module.exports = router;

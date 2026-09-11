const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { uploadDirectory } = require("../config/storage");

const Order = require("../models/Order");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

const studentOnly = [
  authenticateToken,
  requireRole("student", "tutor"),
];

const paymentSlipDirectory = uploadDirectory("payment-slips");

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, paymentSlipDirectory);
    },

    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();

      callback(
        null,
        `${crypto.randomUUID()}${extension}`
      );
    },
  }),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(
        new Error(
          "Payment slip must be a PDF, JPG, PNG, or WebP file"
        )
      );
    }

    return callback(null, true);
  },
});

/*
 * Upload a payment slip for the student's own order.
 *
 * POST /api/payment/:orderId/slip
 */
router.post(
  "/:orderId/slip",
  ...studentOnly,
  upload.single("paymentSlip"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please upload a payment slip",
        });
      }

      const order = await Order.findOne({
        _id: req.params.orderId,
        student: req.user.id,
      });

      if (!order) {
        fs.unlinkSync(req.file.path);

        return res.status(404).json({
          message: "Order not found",
        });
      }

      if (
        order.status !== "pending" &&
        order.status !== "rejected"
      ) {
        fs.unlinkSync(req.file.path);

        return res.status(400).json({
          message:
            "This order cannot accept a payment slip in its current status",
        });
      }

      const updated = await Order.findOneAndUpdate({
        _id: order._id, student: req.user._id, status: order.status,
        updatedAt: order.updatedAt,
      }, { $set: {
        paymentSlip: { originalName: req.file.originalname, storedName: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, uploadedAt: new Date() },
        submittedAt: new Date(), status: "awaiting_verification", rejectionReason: "",
      } }, { new: true, runValidators: true });
      if (!updated) {
        fs.unlinkSync(req.file.path);
        return res.status(409).json({ message: "Order changed while uploading. Refresh the order before retrying." });
      }
      // Retain previous evidence; backups and a reviewed retention job can archive it.
      // Never remove a referenced file before its replacement is committed.
      Object.assign(order, updated.toObject());

      return res.status(200).json({
        message: "Payment slip uploaded successfully",
        order: {
          _id: order._id,
          orderReference: order.orderReference,
          status: order.status,
          submittedAt: order.submittedAt,
          paymentSlip: {
            originalName: order.paymentSlip.originalName,
            mimeType: order.paymentSlip.mimeType,
            size: order.paymentSlip.size,
            uploadedAt: order.paymentSlip.uploadedAt,
          },
        },
      });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        message: "Unable to upload payment slip",
        error: error.message,
      });
    }
  }
);

router.use((error, _req, res, _next) => {
  return res.status(400).json({
    message: error.message,
  });
});

module.exports = router;

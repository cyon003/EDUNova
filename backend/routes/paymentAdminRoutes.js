const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { uploadDirectory } = require("../config/storage");

const PaymentSetting = require("../models/PaymentSetting");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

const adminOnly = [
  authenticateToken,
  requireRole("admin"),
];

const paymentQrDirectory = uploadDirectory("payment-qr");

const allowedQrTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, paymentQrDirectory);
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
    if (!allowedQrTypes.has(file.mimetype)) {
      return callback(
        new Error("QR code must be a JPG, PNG, or WebP image")
      );
    }

    return callback(null, true);
  },
});

/*
 * Get current payment settings.
 *
 * GET /api/admin/payment-settings
 */
router.get("/", ...adminOnly, async (_req, res) => {
  try {
    let settings = await PaymentSetting.findOne({
      key: "manual_qr",
    }).lean();

    if (!settings) {
      settings = await PaymentSetting.create({
        key: "manual_qr",
      });

      settings = settings.toObject();
    }

    return res.json({
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to load payment settings",
      error: error.message,
    });
  }
});

/*
 * Update payment information.
 *
 * PUT /api/admin/payment-settings
 */
router.put("/", ...adminOnly, async (req, res) => {
  try {
    const {
      receiverName,
      paymentMethod,
      accountName,
      accountNumber,
      isActive,
    } = req.body;

    const settings = await PaymentSetting.findOneAndUpdate(
      { key: "manual_qr" },
      {
        $set: {
          receiverName:
            typeof receiverName === "string"
              ? receiverName.trim()
              : "",

          paymentMethod:
            typeof paymentMethod === "string"
              ? paymentMethod.trim()
              : "",

          accountName:
            typeof accountName === "string"
              ? accountName.trim()
              : "",

          accountNumber:
            typeof accountNumber === "string"
              ? accountNumber.trim()
              : "",

          ...(typeof isActive === "boolean"
            ? { isActive }
            : {}),
        },

        $setOnInsert: {
          key: "manual_qr",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).lean();

    return res.json({
      message: "Payment settings updated successfully",
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to update payment settings",
      error: error.message,
    });
  }
});

/*
 * Upload or replace the receiver QR code.
 *
 * POST /api/admin/payment-settings/qr
 */
router.post(
  "/qr",
  ...adminOnly,
  upload.single("qrCode"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please upload a QR code image",
        });
      }

      let settings = await PaymentSetting.findOne({
        key: "manual_qr",
      });

      if (!settings) {
        settings = new PaymentSetting({
          key: "manual_qr",
        });
      }

      // Remove the previous QR image when replacing it.
      if (settings.qrCode?.storedName) {
        const previousFile = path.join(
          paymentQrDirectory,
          settings.qrCode.storedName
        );

        if (fs.existsSync(previousFile)) {
          fs.unlinkSync(previousFile);
        }
      }

      settings.qrCode = {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
      };

      await settings.save();

      return res.status(200).json({
        message: "QR code uploaded successfully",
        settings: {
          _id: settings._id,
          receiverName: settings.receiverName,
          paymentMethod: settings.paymentMethod,
          accountName: settings.accountName,
          accountNumber: settings.accountNumber,
          isActive: settings.isActive,
          qrCode: {
            originalName: settings.qrCode.originalName,
            mimeType: settings.qrCode.mimeType,
            size: settings.qrCode.size,
            uploadedAt: settings.qrCode.uploadedAt,
          },
        },
      });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        message: "Unable to upload QR code",
        error: error.message,
      });
    }
  }
);

/*
 * Download/view the QR code.
 *
 * Students and admins can access it only when authenticated.
 *
 * GET /api/admin/payment-settings/qr
 */
router.get(
  "/qr",
  authenticateToken,
  async (req, res) => {
    try {
      const settings = await PaymentSetting.findOne({
        key: "manual_qr",
      }).lean();

      if (!settings?.isActive || !settings.qrCode?.storedName) {
        return res.status(404).json({
          message: "Payment QR code is not available",
        });
      }

      const filePath = path.join(
        paymentQrDirectory,
        settings.qrCode.storedName
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: "Payment QR code file not found",
        });
      }

      res.setHeader(
        "Content-Type",
        settings.qrCode.mimeType || "image/png"
      );

      return res.sendFile(filePath);
    } catch (error) {
      return res.status(500).json({
        message: "Unable to load payment QR code",
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

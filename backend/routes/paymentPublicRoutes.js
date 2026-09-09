const express = require("express");
const fs = require("fs");
const path = require("path");
const { uploadDirectory } = require("../config/storage");

const PaymentSetting = require("../models/PaymentSetting");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

const paymentQrDirectory = uploadDirectory("payment-qr");

// Students need to be logged in to see payment information.
router.use(authenticateToken);

// GET /api/payment-settings
// Student-safe payment information.
// Does not expose admin-only settings.
router.get("/", async (req, res) => {
  try {
    const settings = await PaymentSetting.findOne({
      key: "manual_qr",
      isActive: true,
    }).lean();

    if (!settings) {
      return res.json({
        receiverName: "",
        paymentMethod: "",
        accountName: "",
        accountNumber: "",
        qrUrl: "",
        isActive: false,
      });
    }

    const hasQr =
      settings.qrCode &&
      settings.qrCode.storedName &&
      fs.existsSync(
        path.join(paymentQrDirectory, settings.qrCode.storedName)
      );

    return res.json({
      receiverName: settings.receiverName || "",
      paymentMethod: settings.paymentMethod || "",
      accountName: settings.accountName || "",
      accountNumber: settings.accountNumber || "",
      qrUrl: hasQr ? "/api/payment-settings/qr" : "",
      isActive: Boolean(settings.isActive),
    });
  } catch (error) {
    console.error("Load public payment settings error:", error);

    return res.status(500).json({
      message: "Unable to load payment settings.",
    });
  }
});

// GET /api/payment-settings/qr
// Streams the active payment QR code to authenticated users.
router.get("/qr", async (req, res) => {
  try {
    const settings = await PaymentSetting.findOne({
      key: "manual_qr",
      isActive: true,
    }).lean();

    if (!settings?.qrCode?.storedName) {
      return res.status(404).json({
        message: "Payment QR code is not configured.",
      });
    }

    const filePath = path.join(
      paymentQrDirectory,
      settings.qrCode.storedName
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "Payment QR code file not found.",
      });
    }

    res.setHeader(
      "Content-Type",
      settings.qrCode.mimeType || "image/png"
    );

    return res.sendFile(filePath);
  } catch (error) {
    console.error("Load public payment QR error:", error);

    return res.status(500).json({
      message: "Unable to load payment QR code.",
    });
  }
});

module.exports = router;

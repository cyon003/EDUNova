const mongoose = require("mongoose");

const paymentSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "manual_qr",
    },

    receiverName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    paymentMethod: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    accountName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    accountNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    qrCode: {
      originalName: {
        type: String,
        default: "",
        trim: true,
      },

      storedName: {
        type: String,
        default: "",
        trim: true,
      },

      mimeType: {
        type: String,
        default: "",
        trim: true,
      },

      size: {
        type: Number,
        default: 0,
        min: 0,
      },

      uploadedAt: {
        type: Date,
        default: null,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "PaymentSetting",
  paymentSettingSchema
);
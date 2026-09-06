const mongoose = require("mongoose");

// One order document per purchase session.
// Stores the courses, server-side prices, payment reference,
// uploaded slip information, and admin verification status.

const orderSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
          required: true,
        },

        // Price copied from the Course document by the backend.
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    // Total calculated by the backend from the course prices.
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Unique reference shown to the student and checked by admin.
    orderReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "awaiting_verification",
        "completed",
        "rejected",
        "failed",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["manual_qr", "free", "stripe", "mock"],
      default: "manual_qr",
    },

    // Kept for compatibility with older orders / payment systems.
    paymentReference: {
      type: String,
      default: "",
      trim: true,
    },

    // Payment slip information.
    paymentSlip: {
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

    // Student submits the slip.
    submittedAt: {
      type: Date,
      default: null,
    },

    // Admin verification information.
    verifiedAt: {
      type: Date,
      default: null,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Filled when admin rejects the payment slip.
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // Set when payment is successfully approved.
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
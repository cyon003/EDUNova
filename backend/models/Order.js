const mongoose = require("mongoose");

// One order document per purchase session.
// Stores the courses, server-side prices, Stripe payment reference,
// and payment completion status.

const orderSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    paymentType: {
      type: String,
      enum: ["course", "subscription"],
      default: "course",
      immutable: true,
    },

    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      immutable: true,
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

    // Unique reference shown to the student.
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

    // Payment provider used for this order.
    // Free courses do not need an external payment.
    // Paid courses and Premium use Stripe Test Mode.
    paymentMethod: {
      type: String,
      enum: ["free", "stripe"],
      default: "stripe",
    },

    // Stripe Checkout Session ID.
    //
    // Kept in the existing paymentReference field so the
    // rest of the application can continue using the field
    // without needing a database migration.
    paymentReference: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    // Set when Stripe payment has been successfully verified
    // by the backend.
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.pre("validate", function () {
  // --------------------------------------------------
  // Premium subscription validation
  // --------------------------------------------------

  if (this.paymentType === "subscription") {
    if (!["monthly", "yearly"].includes(this.billingCycle)) {
      this.invalidate(
        "billingCycle",
        "Premium requires a billing cycle."
      );
    }

    const premiumPrices = {
      monthly: 99,
      yearly: 999,
    };

    if (
      this.totalAmount !== premiumPrices[this.billingCycle]
    ) {
      this.invalidate(
        "totalAmount",
        "Invalid Premium price."
      );
    }

    if (Array.isArray(this.items) && this.items.length > 0) {
      this.invalidate(
        "items",
        "Premium payments cannot contain courses."
      );
    }

    if (this.paymentMethod !== "stripe") {
      this.invalidate(
        "paymentMethod",
        "Premium payments must use Stripe."
      );
    }

    return;
  }

  // --------------------------------------------------
  // Course order validation
  // --------------------------------------------------

  if (this.billingCycle != null) {
    this.invalidate(
      "billingCycle",
      "Course orders cannot contain a subscription cycle."
    );
  }

  // Paid courses use Stripe.
  // Free courses use the "free" payment method.
  if (this.totalAmount > 0 && this.paymentMethod !== "stripe") {
    this.invalidate(
      "paymentMethod",
      "Paid course orders must use Stripe."
    );
  }

  if (this.totalAmount === 0 && this.paymentMethod !== "free") {
    this.invalidate(
      "paymentMethod",
      "Free course orders must use the free payment method."
    );
  }
});

module.exports = mongoose.model("Order", orderSchema);
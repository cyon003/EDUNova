const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "tutor", "admin"],
      default: "student",
    },

    accountStatus: {
      type: String,
      enum: ["approved", "suspended"],
      default: "approved",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    loginLockedUntil: {
      type: Date,
      default: null,
    },

    tutorVerificationStatus: {
      type: String,
      enum: ["DRAFT", "UNDER_REVIEW", "MORE_INFORMATION_NEEDED", "APPROVED", "REJECTED", "incomplete", "pending_review", "verified", "needs_changes", "rejected", "suspended"],
      default: "DRAFT",
    },
    tutorProfile: {
      photoUrl: { type: String, default: "", trim: true },
      phoneNumber: { type: String, default: "", trim: true },
      bio: { type: String, default: "", trim: true },
      expertise: { type: String, default: "", trim: true },
      education: { type: String, default: "", trim: true },
      teachingExperience: { type: String, default: "", trim: true },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);

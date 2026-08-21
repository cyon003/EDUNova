const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const tutorApplicationSchema = new mongoose.Schema({
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  trackingTokenHash: { type: String, required: true, select: false },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  phoneNumber: { type: String, default: "", trim: true, maxlength: 40 },
  identityType: { type: String, enum: ["", "Passport", "National ID"], default: "" },
  identityNumber: { type: String, default: "", trim: true, maxlength: 100 },
  identityPhoto: { type: documentSchema, default: null },
  expertise: { type: String, default: "", trim: true, maxlength: 200 },
  teachingLevel: {
    type: String,
    enum: ["", "Beginner", "Intermediate", "Advanced"],
    default: "",
  },
  teachingExperience: { type: String, default: "", trim: true, maxlength: 1500 },
  introduction: { type: String, default: "", trim: true, maxlength: 1500 },
  institution: { type: String, default: "", trim: true, maxlength: 200 },
  major: { type: String, default: "", trim: true, maxlength: 200 },
  educationLevel: { type: String, default: "", trim: true, maxlength: 120 },
  cv: { type: documentSchema, default: null },
  certificate: { type: documentSchema, default: null },
  motivation: { type: String, default: "", trim: true, maxlength: 2000 },
  confirmed: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["DRAFT", "UNDER_REVIEW", "MORE_INFORMATION_NEEDED", "APPROVED", "REJECTED"],
    default: "DRAFT",
  },
  decisionReason: { type: String, default: "", trim: true, maxlength: 2000 },
  submittedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

module.exports = mongoose.model("TutorApplication", tutorApplicationSchema);

const mongoose = require("mongoose");

const tutorApplicationSchema = new mongoose.Schema({
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  legalName: { type: String, required: true, trim: true, maxlength: 120 },
  profilePhotoUrl: { type: String, default: "", trim: true },
  bio: { type: String, default: "", trim: true, maxlength: 2000 },
  subjects: { type: [String], default: [] },
  educationLevel: { type: String, default: "", trim: true },
  degree: { type: String, default: "", trim: true },
  fieldOfStudy: { type: String, default: "", trim: true },
  institution: { type: String, default: "", trim: true },
  graduationYear: { type: Number, default: null, min: 1900, max: 2200 },
  teachingExperienceYears: { type: Number, default: 0, min: 0, max: 80 },
  professionalExperience: { type: String, default: "", trim: true, maxlength: 3000 },
  certifications: { type: [String], default: [] },
  portfolioUrl: { type: String, default: "", trim: true },
  linkedInUrl: { type: String, default: "", trim: true },
  identityDocumentUrl: { type: String, default: "", trim: true },
  credentialDocumentUrls: { type: [String], default: [] },
  status: {
    type: String,
    enum: ["incomplete", "pending_review", "verified", "needs_changes", "rejected", "suspended"],
    default: "incomplete",
  },
  decisionReason: { type: String, default: "", trim: true, maxlength: 2000 },
  submittedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

module.exports = mongoose.model("TutorApplication", tutorApplicationSchema);

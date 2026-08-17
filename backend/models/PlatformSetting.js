const mongoose = require("mongoose");

const platformSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "platform" },
  maxEnrollment: { type: Number, default: 150, min: 1 },
  minPassScore: { type: Number, default: 60, min: 0, max: 100 },
  approvalRequired: { type: Boolean, default: true },
  allowSelfEnroll: { type: Boolean, default: true },
  sessionTimeout: { type: Number, default: 30, min: 1 },
  maxLoginAttempts: { type: Number, default: 5, min: 1 },
  categories: { type: [String], default: ["General Education", "STEM", "Languages", "Humanities", "Business", "Wellness"] },
}, { timestamps: true });

module.exports = mongoose.model("PlatformSetting", platformSettingSchema);

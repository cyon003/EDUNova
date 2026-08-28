const mongoose = require("mongoose");

const refreshSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  familyId: { type: String, required: true, index: true },
  createdAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, enum: ["", "rotated", "logout", "logout_all", "reuse_detected", "password_changed", "account_changed", "expired"], default: "" },
  replacedByHash: { type: String, default: "", select: false },
  userAgent: { type: String, default: "", maxlength: 500 },
  ipAddress: { type: String, default: "", maxlength: 100 },
}, { versionKey: false });

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });

module.exports = mongoose.model("RefreshSession", refreshSessionSchema);

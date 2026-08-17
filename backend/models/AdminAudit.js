const mongoose = require("mongoose");

const adminAuditSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true, trim: true },
  detail: { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model("AdminAudit", adminAuditSchema);

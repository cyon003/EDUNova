const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  detail: { type: String, required: true, trim: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
  status: { type: String, enum: ["pending", "reviewing", "resolved", "dismissed"], default: "pending" },
  adminNote: { type: String, default: "", trim: true, maxlength: 3000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

module.exports = mongoose.model("Report", reportSchema);

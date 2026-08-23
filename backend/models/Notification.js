const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
  source: { type: String, enum: ["SYSTEM", "ADMIN"], required: true },
  type: {
    type: String,
    enum: ["system", "course_submitted", "course_approved", "course_rejected", "tutor_application", "account"],
    default: "system",
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

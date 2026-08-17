const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    lessonIndex: { type: Number, default: null, min: 0 },
    lessonTitle: { type: String, default: "", trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 30000 },
  },
  { timestamps: true }
);

noteSchema.index({ student: 1, updatedAt: -1 });

module.exports = mongoose.model("Note", noteSchema);

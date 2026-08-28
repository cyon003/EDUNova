const mongoose = require("mongoose");

const lessonResourceChunkSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  resource: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  originalFilename: { type: String, required: true, trim: true, maxlength: 500 },
  contentType: { type: String, required: true, enum: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"] },
  chunkNumber: { type: Number, required: true, min: 1 },
  pageNumber: { type: Number, default: null, min: 1 },
  content: { type: String, required: true, trim: true },
}, { timestamps: true });

lessonResourceChunkSchema.index({ resource: 1, chunkNumber: 1 }, { unique: true });
lessonResourceChunkSchema.index({ course: 1, lesson: 1, resource: 1, chunkNumber: 1 });

module.exports = mongoose.model("LessonResourceChunk", lessonResourceChunkSchema);


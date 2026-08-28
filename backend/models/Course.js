const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      default: "General Education",
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    // Price in USD — 0 means free
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    thumbnail: { type: String, default: "", trim: true },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    moderationStatus: {
      type: String,
      enum: ["pending", "published", "unpublished", "rejected", "archived"],
      default: "unpublished",
    },
    reviewFeedback: { type: String, default: "", trim: true },
    reviewedAt: { type: Date, default: null },
    lessons: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
          maxlength: [200, "Lesson title cannot exceed 200 characters"],
        },
        description: {
          type: String,
          default: "",
          trim: true,
        },
        duration: {
          type: String,
          default: "",
          trim: true,
        },
        videoUrl: {
          type: String,
          default: "",
          trim: true,
        },
        resources: [{
          originalName: { type: String, required: true, trim: true },
          storedName:   { type: String, required: true, trim: true },
          mimeType:     { type: String, required: true, trim: true },
          size:         { type: Number, required: true, min: 0 },
          url:          { type: String, required: true, trim: true },
          extractionStatus: { type: String, enum: ["pending", "processing", "completed", "failed"], default: null },
          extractionFailureReason: { type: String, default: "", trim: true, maxlength: 300 },
          extractedAt: { type: Date, default: null },
          extractedChunkCount: { type: Number, default: 0, min: 0 },
        }],
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Course", courseSchema);

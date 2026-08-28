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
        summary: {
          type: String,
          default: "",
          trim: true,
          maxlength: [5000, "Lesson summary cannot exceed 5000 characters"],
        },
        transcript: {
          type: String,
          default: "",
          trim: true,
          maxlength: [50000, "Lesson transcript cannot exceed 50000 characters"],
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
        primaryMedia: {
          originalName: { type: String, default: "", trim: true },
          storedName: { type: String, default: "", trim: true },
          mimeType: { type: String, default: "", trim: true },
          size: { type: Number, default: 0, min: 0 },
          url: { type: String, default: "", trim: true },
          storage: { type: String, enum: ["course-videos", "lesson-resources"], default: "course-videos" },
          resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
        },
        primaryMediaRemoved: { type: Boolean, default: false },
        references: [{
          label: { type: String, default: "Reference", trim: true, maxlength: 200 },
          url: { type: String, required: true, trim: true, maxlength: 2000 },
        }],
        resources: [{
          originalName: { type: String, required: true, trim: true },
          storedName:   { type: String, required: true, trim: true },
          mimeType:     { type: String, required: true, trim: true },
          size:         { type: Number, required: true, min: 0 },
          url:          { type: String, required: true, trim: true },
        }],
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Course", courseSchema);

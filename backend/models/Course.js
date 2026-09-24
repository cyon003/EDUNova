const mongoose = require("mongoose");
const { MAX_TOPIC_TITLE, topicRangesError } = require("../utils/lessonTopics");

const quizOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Quiz option cannot exceed 500 characters"],
    },
  },
  { _id: true }
);

// Optional picture or audio clip attached to a quiz question. The file itself
// lives in uploads/quiz-media and is only served to enrolled students.
const quizMediaSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true, trim: true, maxlength: 200 },
    storedName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ["image", "audio"], required: true },
  },
  { _id: false }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, "Quiz question cannot exceed 1000 characters"],
    },

    type: {
      type: String,
      enum: ["multiple_choice", "true_false"],
      default: "multiple_choice",
      required: true,
    },

    options: {
      type: [quizOptionSchema],
      default: [],
    },

    correctOption: {
      type: Number,
      required: true,
      min: 0,
    },

    media: {
      type: quizMediaSchema,
      default: null,
    },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Lesson Quiz",
      trim: true,
      maxlength: [200, "Quiz title cannot exceed 200 characters"],
    },

    questions: {
      type: [quizQuestionSchema],
      default: [],
    },
  },
  { _id: true }
);

const courseSchema = new mongoose.Schema(
  {
    enrollmentRevision: { type: Number, default: 0, select: false },

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

    reviewCount: { type: Number, default: 0, min: 0 },
    courseReviews: { type: [{
      student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
      rating: { type: Number, min: 1, max: 5, required: true },
      comment: { type: String, default: "", maxlength: 2000 },
      updatedAt: { type: Date, default: Date.now },
    }], default: [], select: false },
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

    thumbnail: {
      type: String,
      default: "",
      trim: true,
    },

    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    moderationStatus: {
      type: String,
      enum: ["pending", "published", "unpublished", "rejected", "archived"],
      default: "unpublished",
    },

    reviewFeedback: {
      type: String,
      default: "",
      trim: true,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

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
        topics: {
          type: [{
            title: { type: String, required: true, trim: true, maxlength: MAX_TOPIC_TITLE },
            startTimeSeconds: { type: Number, required: true, min: 0 },
            endTimeSeconds: { type: Number, required: true, min: 0 },
          }],
          default: [],
          validate: { validator: topics => !topicRangesError(topics), message: "Invalid, unordered or overlapping lesson topics" },
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
          originalName: {
            type: String,
            default: "",
            trim: true,
          },

          storedName: {
            type: String,
            default: "",
            trim: true,
          },

          mimeType: {
            type: String,
            default: "",
            trim: true,
          },

          size: {
            type: Number,
            default: 0,
            min: 0,
          },

          url: {
            type: String,
            default: "",
            trim: true,
          },

          storage: {
            type: String,
            enum: ["course-videos", "lesson-resources"],
            default: "course-videos",
          },

          resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
          },
        },

        primaryMediaRemoved: {
          type: Boolean,
          default: false,
        },

        posterUrl: {
          type: String,
          default: "",
          trim: true,
        },

        references: [
          {
            label: {
              type: String,
              default: "Reference",
              trim: true,
              maxlength: 200,
            },

            url: {
              type: String,
              required: true,
              trim: true,
              maxlength: 2000,
            },
          },
        ],

        resources: [
          {
            originalName: {
              type: String,
              required: true,
              trim: true,
            },

            storedName: {
              type: String,
              required: true,
              trim: true,
            },

            mimeType: {
              type: String,
              required: true,
              trim: true,
            },

            size: {
              type: Number,
              required: true,
              min: 0,
            },

            url: {
              type: String,
              required: true,
              trim: true,
            },
          },
        ],

        // Optional quiz attached to this lesson.
        // Correct answers are stored here for backend grading.
        // Student-facing APIs will later remove correctOption
        // before returning quiz data.
        quiz: {
          type: quizSchema,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    toJSON: { transform(_doc, value) {
      // Seeded ratings are not student reviews. Hide private review storage.
      value.rating = value.reviewCount ? value.rating : 0;
      value.reviewCount = value.reviewCount || 0;
      delete value.courseReviews;
      return value;
    } },
  }
);

module.exports = mongoose.model("Course", courseSchema);
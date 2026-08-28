const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema({
  id: { type: String, default: "", trim: true },
  title: { type: String, default: "", trim: true },
  type: { type: String, enum: ["", "course", "lesson", "resource"], default: "" },
  filename: { type: String, default: "", trim: true, maxlength: 500 },
  lessonTitle: { type: String, default: "", trim: true, maxlength: 200 },
  chunkNumber: { type: Number, default: null, min: 1 },
  pageNumber: { type: Number, default: null, min: 1 },
  confidence: { type: Number, default: null, min: 0, max: 1 },
}, { _id: false });

const chatbotConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mode: { type: String, enum: ["course", "general"], required: true, default: "course", index: true },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
      index: true,
      required() { return this.mode === "course"; },
      validate: { validator(value) { return this.mode === "course" ? Boolean(value) : value === null; }, message: "Course is allowed only in course mode" },
    },
    lesson: { type: mongoose.Schema.Types.ObjectId, default: null },
    userMessage: { type: String, required: true, trim: true, maxlength: 1000 },
    retrievalTopic: { type: String, default: "", trim: true, maxlength: 1000, select: false },
    assistantAnswer: { type: String, required: true, trim: true, maxlength: 8000 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    source: { type: sourceSchema, default: () => ({}) },
    sources: { type: [sourceSchema], default: [] },
    fallback: { type: Boolean, required: true, default: false },
    answerMode: { type: String, enum: ["generated", "extractive", "fallback", "unavailable"], default: "extractive" },
  },
  { timestamps: true }
);

chatbotConversationSchema.index({ user: 1, createdAt: -1 });
chatbotConversationSchema.index({ user: 1, mode: 1, course: 1, lesson: 1, createdAt: -1 });

chatbotConversationSchema.pre("validate", function validateModeIsolation() {
  if (this.mode === "general" && (this.course || this.lesson || this.source?.id || this.sources?.length)) {
    this.invalidate("mode", "General conversations cannot contain course, lesson, or source metadata");
  }
});

module.exports = mongoose.model("ChatbotConversation", chatbotConversationSchema);

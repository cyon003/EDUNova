const mongoose = require("mongoose");

const chatbotConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mode: { type: String, enum: ["general", "lesson"], required: true, default: "general", index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: function () { return this.mode === "lesson"; }, default: null },
    lessonId: { type: mongoose.Schema.Types.ObjectId, required: function () { return this.mode === "lesson"; }, default: null },
    videoTimestampSeconds: { type: Number, min: 0, required: function () { return this.mode === "lesson"; }, validate: value => value == null || Number.isFinite(value), default: null },
    topicId: { type: mongoose.Schema.Types.ObjectId, default: null },
    topicTitle: { type: String, maxlength: 200, default: null },
    userMessage: { type: String, required: true, trim: true, maxlength: 1000 },
    assistantAnswer: { type: String, required: true, trim: true, maxlength: 8000 },
    answerMode: { type: String, enum: ["generated"], default: "generated" },
  },
  { timestamps: true }
);

chatbotConversationSchema.index({ user: 1, createdAt: -1 });
chatbotConversationSchema.index({ user: 1, mode: 1, createdAt: -1 });

chatbotConversationSchema.index({ user: 1, mode: 1, course: 1, lessonId: 1, topicId: 1, createdAt: -1 });

module.exports = mongoose.model("ChatbotConversation", chatbotConversationSchema);

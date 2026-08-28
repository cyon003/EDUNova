const mongoose = require("mongoose");

const chatbotConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mode: { type: String, enum: ["general"], required: true, default: "general", index: true },
    userMessage: { type: String, required: true, trim: true, maxlength: 1000 },
    assistantAnswer: { type: String, required: true, trim: true, maxlength: 8000 },
    answerMode: { type: String, enum: ["generated"], default: "generated" },
  },
  { timestamps: true }
);

chatbotConversationSchema.index({ user: 1, createdAt: -1 });
chatbotConversationSchema.index({ user: 1, mode: 1, createdAt: -1 });

module.exports = mongoose.model("ChatbotConversation", chatbotConversationSchema);

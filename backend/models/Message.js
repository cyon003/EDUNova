const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      validate: {
        validator(recipientId) {
          return !this.sender || String(this.sender) !== String(recipientId);
        },
        message: "You cannot send a message to yourself",
      },
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      minlength: [1, "Message content is required"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, recipient: 1, course: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, read: 1, deletedAt: 1, createdAt: -1 });

messageSchema.pre("validate", function setReadTimestamp() {
  if (this.read && !this.readAt) this.readAt = new Date();
  if (!this.read) this.readAt = null;
});

module.exports = mongoose.model("Message", messageSchema);

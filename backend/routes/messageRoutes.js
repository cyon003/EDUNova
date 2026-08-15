const express = require("express");
const mongoose = require("mongoose");
const authenticateToken = require("../middleware/authMiddleware");
const Message = require("../models/Message");
const User = require("../models/User");

const router = express.Router();

router.use(authenticateToken);

router.get("/contacts", async (req, res) => {
  try {
    const contactRole = req.user.role === "student" ? "tutor" : "student";
    if (!["student", "tutor"].includes(req.user.role)) return res.json([]);
    const contacts = await User.find({ role: contactRole, accountStatus: "approved" })
      .select("name email role")
      .sort({ name: 1 });
    return res.json(contacts);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load contacts", error: error.message });
  }
});

router.get("/:contactId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.contactId)) return res.status(400).json({ message: "Invalid contact" });
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: req.params.contactId },
        { sender: req.params.contactId, recipient: req.user._id },
      ],
    }).sort({ createdAt: 1 }).limit(200);
    await Message.updateMany(
      { sender: req.params.contactId, recipient: req.user._id, read: false },
      { read: true }
    );
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load messages", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const content = req.body.content?.trim();
    const recipientId = req.body.recipientId;
    if (!content || !mongoose.isValidObjectId(recipientId)) return res.status(400).json({ message: "Recipient and message are required" });
    const recipient = await User.findById(recipientId);
    const allowed = recipient && recipient.accountStatus === "approved" &&
      ((req.user.role === "student" && recipient.role === "tutor") ||
       (req.user.role === "tutor" && recipient.role === "student"));
    if (!allowed) return res.status(403).json({ message: "This contact is unavailable" });
    const message = await Message.create({ sender: req.user._id, recipient: recipientId, content });
    return res.status(201).json(message);
  } catch (error) {
    return res.status(500).json({ message: "Unable to send message", error: error.message });
  }
});

module.exports = router;

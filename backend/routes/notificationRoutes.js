const express = require("express");
const Notification = require("../models/Notification");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authenticateToken);

router.get("/", async (req,res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).populate("course", "name slug moderationStatus").sort({ createdAt: -1 }).limit(50).lean();
    return res.json(notifications);
  } catch (error) { return res.status(500).json({ message: "Unable to load notifications", error: error.message }); }
});

router.get("/unread-count", async (req,res) => {
  try { return res.json({ count: await Notification.countDocuments({ user: req.user._id, isRead: false }) }); }
  catch (error) { return res.status(500).json({ message: "Unable to load unread count", error: error.message }); }
});

router.patch("/read-all", async (req,res) => {
  try { await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } }); return res.json({ message: "Notifications marked as read" }); }
  catch (error) { return res.status(500).json({ message: "Unable to update notifications", error: error.message }); }
});

router.patch("/:notificationId/read", async (req,res) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, user: req.user._id }, { $set: { isRead: true } }, { new: true });
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    return res.json(notification);
  } catch (error) { return res.status(500).json({ message: "Unable to update notification", error: error.message }); }
});

module.exports = router;

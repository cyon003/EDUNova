const express = require("express");
const Announcement = require("../models/Announcement");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const audience = req.user.role === "student" ? "Students" : req.user.role === "tutor" ? "Tutors" : null;
    const query = { active: true, audience: audience ? { $in: ["All Users", audience] } : "All Users" };
    const announcements = await Announcement.find(query)
      .select("title audience createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.json(announcements);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load announcements", error: error.message });
  }
});

module.exports = router;

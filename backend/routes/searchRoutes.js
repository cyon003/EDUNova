const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const Course = require("../models/Course");
const User = require("../models/User");

const router = express.Router();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (query.length < 2) return res.json({ users: [], courses: [] });
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const search = new RegExp(safeQuery, "i");
    const [users, courses] = await Promise.all([
      User.find({ name: search, role: { $in: ["student", "tutor"] }, accountStatus: "approved" })
        .select("name role")
        .limit(8),
      Course.find({ $or: [{ name: search }, { category: search }, { description: search }] })
        .select("name slug category")
        .limit(8),
    ]);
    return res.json({ users, courses });
  } catch (error) {
    return res.status(500).json({ message: "Unable to search", error: error.message });
  }
});

module.exports = router;

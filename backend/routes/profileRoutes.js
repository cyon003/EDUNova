const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const User = require("../models/User");

const router = express.Router();

router.use(authenticateToken, requireRole("student"));

router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("name email role studentProfile createdAt")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get student profile error:", error);
    return res.status(500).json({ message: "Unable to load profile" });
  }
});

router.patch("/", async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ message: "Full name is required" });

    const update = { name };
    const allowedFields = ["username", "bio", "photoUrl", "phoneNumber"];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        update[`studentProfile.${field}`] = String(req.body[field]).trim();
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .select("name email role studentProfile createdAt")
      .lean();

    return res.status(200).json({ message: "Profile saved", user });
  } catch (error) {
    console.error("Update student profile error:", error);
    return res.status(400).json({ message: error.message || "Unable to save profile" });
  }
});

module.exports = router;

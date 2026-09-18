const express = require("express");
const LearningSignal = require("../models/LearningSignal");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { summarizeWeeklyGoal } = require("../services/weeklyGoalService");

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole("student"));

async function goalResponse(user, res) {
  const signals = await LearningSignal.find({ student: user._id }).select("activeTimeSecondsByWeek");
  return res.json(summarizeWeeklyGoal(user.weeklyGoalMinutes, signals));
}

router.get("/me", async (req, res) => {
  try {
    return await goalResponse(req.user, res);
  } catch (error) {
    console.error("Get weekly goal error:", error);
    return res.status(500).json({ message: "Unable to load weekly learning goal" });
  }
});

router.put("/me", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, "weeklyGoalMinutes") || !Number.isInteger(body.weeklyGoalMinutes) || body.weeklyGoalMinutes < 1 || body.weeklyGoalMinutes > 10080) {
      return res.status(400).json({ message: "Weekly goal must be a whole number from 1 to 10080 minutes" });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, role: "student" },
      { $set: { weeklyGoalMinutes: body.weeklyGoalMinutes } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: "Student account not found" });
    return await goalResponse(user, res);
  } catch (error) {
    console.error("Update weekly goal error:", error);
    return res.status(500).json({ message: "Unable to update weekly learning goal" });
  }
});

module.exports = router;

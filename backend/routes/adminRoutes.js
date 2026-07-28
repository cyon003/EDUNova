const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const authenticateToken = require(
  "../middleware/authMiddleware"
);
const requireRole = require(
  "../middleware/roleMiddleware"
);

const router = express.Router();

// Every endpoint below requires an admin account.
router.use(authenticateToken);
router.use(requireRole("admin"));

// GET ALL TUTORS
router.get("/tutors", async (req, res) => {
  try {
    const tutors = await User.find({
      role: "tutor",
    })
      .select("-password")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(tutors);
  } catch (error) {
    console.error("Get tutors error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// CREATE A TUTOR ACCOUNT
router.post("/tutors", async (req, res) => {
  try {
    const { name, email, temporaryPassword } = req.body;

    if (!name || !email || !temporaryPassword) {
      return res.status(400).json({
        message:
          "Tutor name, email and temporary password are required",
      });
    }

    if (temporaryPassword.length < 6) {
      return res.status(400).json({
        message:
          "Temporary password must contain at least 6 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "This email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(
      temporaryPassword,
      10
    );

    const tutor = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "tutor",
      accountStatus: "approved",
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message:
        "Tutor account created successfully. Give the temporary password to the tutor.",
      tutor: {
        id: tutor._id,
        name: tutor.name,
        email: tutor.email,
        role: tutor.role,
        accountStatus: tutor.accountStatus,
      },
    });
  } catch (error) {
    console.error("Create tutor error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// UPDATE A TUTOR
router.patch("/tutors/:tutorId", async (req, res) => {
  try {
    const { name, email } = req.body;

    const tutor = await User.findOne({
      _id: req.params.tutorId,
      role: "tutor",
    });

    if (!tutor) {
      return res.status(404).json({
        message: "Tutor not found",
      });
    }

    if (name) {
      tutor.name = name.trim();
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();

      const emailOwner = await User.findOne({
        email: normalizedEmail,
        _id: {
          $ne: tutor._id,
        },
      });

      if (emailOwner) {
        return res.status(400).json({
          message: "This email is already registered",
        });
      }

      tutor.email = normalizedEmail;
    }

    await tutor.save();

    return res.status(200).json({
      message: "Tutor account updated successfully",
      tutor: {
        id: tutor._id,
        name: tutor.name,
        email: tutor.email,
        role: tutor.role,
        accountStatus: tutor.accountStatus,
      },
    });
  } catch (error) {
    console.error("Update tutor error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// RESET A TUTOR PASSWORD
router.patch(
  "/tutors/:tutorId/reset-password",
  async (req, res) => {
    try {
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          message:
            "New password must contain at least 6 characters",
        });
      }

      const tutor = await User.findOne({
        _id: req.params.tutorId,
        role: "tutor",
      });

      if (!tutor) {
        return res.status(404).json({
          message: "Tutor not found",
        });
      }

      tutor.password = await bcrypt.hash(newPassword, 10);

      await tutor.save();

      return res.status(200).json({
        message: "Tutor password reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);

      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// SUSPEND A TUTOR
router.patch(
  "/tutors/:tutorId/suspend",
  async (req, res) => {
    try {
      const tutor = await User.findOneAndUpdate(
        {
          _id: req.params.tutorId,
          role: "tutor",
        },
        {
          accountStatus: "suspended",
        },
        {
          new: true,
        }
      ).select("-password");

      if (!tutor) {
        return res.status(404).json({
          message: "Tutor not found",
        });
      }

      return res.status(200).json({
        message: "Tutor account suspended",
        tutor,
      });
    } catch (error) {
      console.error("Suspend tutor error:", error);

      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// REACTIVATE A TUTOR
router.patch(
  "/tutors/:tutorId/activate",
  async (req, res) => {
    try {
      const tutor = await User.findOneAndUpdate(
        {
          _id: req.params.tutorId,
          role: "tutor",
        },
        {
          accountStatus: "approved",
        },
        {
          new: true,
        }
      ).select("-password");

      if (!tutor) {
        return res.status(404).json({
          message: "Tutor not found",
        });
      }

      return res.status(200).json({
        message: "Tutor account activated",
        tutor,
      });
    } catch (error) {
      console.error("Activate tutor error:", error);

      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
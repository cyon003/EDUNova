const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const PlatformSetting = require("../models/PlatformSetting");
const authenticateToken = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

const normalizeEmail = (email) => {
  return email.toLowerCase().trim();
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "student",
      accountStatus: "approved",
    });

    return res.status(201).json({
      message:
        "Student account created successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const settings = await PlatformSetting.findOne({ key: "platform" }).lean();
    const maxLoginAttempts = settings?.maxLoginAttempts || 5;
    const sessionTimeout = settings?.sessionTimeout || 30;
    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      return res.status(429).json({ message: "Too many failed login attempts. Try again later." });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= maxLoginAttempts) {
        user.loginLockedUntil = new Date(Date.now() + 5 * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({
        message:
          "Your account has been suspended. Please contact an administrator.",
      });
    }

    user.lastLoginAt = new Date();
    user.loginAttempts = 0;
    user.loginLockedUntil = null;
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: `${sessionTimeout}m`,
      }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      accountStatus: req.user.accountStatus,
    },
  });
});

module.exports = router;

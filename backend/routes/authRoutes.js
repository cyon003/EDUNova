const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");

const User = require("../models/User");
const PlatformSetting = require("../models/PlatformSetting");
const authenticateToken = require(
  "../middleware/authMiddleware"
);
const { sendPasswordResetEmail } = require("../services/emailService");
const { createResetToken, hashResetToken, validatePassword } = require("../utils/passwordSecurity");

const router = express.Router();

const createLimiter = (windowMs, limit, message) => rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message },
});

const loginLimiter = createLimiter(15 * 60 * 1000, 10, "Too many login attempts. Try again later.");
const forgotPasswordLimiter = createLimiter(60 * 60 * 1000, 5, "Too many password reset requests. Try again later.");
const resetPasswordLimiter = createLimiter(15 * 60 * 1000, 5, "Too many reset attempts. Try again later.");
const forgotPasswordResponse = "If an account exists for that email, a password reset link has been sent.";

const normalizeEmail = (email) => {
  return String(email).toLowerCase().trim();
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim()) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

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

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email.trim()) {
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
        tokenVersion: user.tokenVersion || 0,
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

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? normalizeEmail(req.body.email) : "";
    const user = email ? await User.findOne({ email }) : null;

    if (user && user.accountStatus === "approved") {
      const { token, tokenHash } = createResetToken();
      const expiresInMinutes = 15;
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      await user.save();

      const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
      console.info("Password reset email attempted");
      const delivery = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: `${frontendUrl}/reset-password/${token}`,
        expiresInMinutes,
      });
      if (delivery.sent) {
        console.info("Password reset email sent");
      } else {
        console.error(`Password reset email failed: ${delivery.errorType || delivery.reason || "unknown_error"}`);
      }
    }

    return res.status(200).json({ message: forgotPasswordResponse });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(200).json({ message: forgotPasswordResponse });
  }
});

router.post("/reset-password/:token", resetPasswordLimiter, async (req, res) => {
  try {
    const passwordError = validatePassword(req.body.password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const tokenHash = hashResetToken(req.params.token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (!user) {
      return res.status(400).json({ message: "This password reset link is invalid or has expired." });
    }

    user.password = await bcrypt.hash(req.body.password, 12);
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    user.loginAttempts = 0;
    user.loginLockedUntil = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Unable to reset password" });
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

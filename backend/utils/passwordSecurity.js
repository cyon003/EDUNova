const crypto = require("crypto");

function validatePassword(password) {
  if (typeof password !== "string") return "Password is required";
  if (password.length < 8) return "Password must contain at least 8 characters";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/\d/.test(password)) return "Password must contain a number";
  return null;
}

function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  return { token, tokenHash };
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function buildPasswordResetUrl(frontendUrl, token) {
  const origin = String(frontendUrl || "http://localhost:5173").replace(/\/$/, "");
  return `${origin}/reset-password/${encodeURIComponent(token)}`;
}

module.exports = { validatePassword, createResetToken, hashResetToken, buildPasswordResetUrl };

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshSession = require("../models/RefreshSession");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, accountStatus: user.accountStatus });
const accessToken = (user) => jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" });
const refreshDays = () => Math.min(Math.max(Number.parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30, 1), 365);
const newRawToken = () => crypto.randomBytes(48).toString("base64url");

function cookieName() { return process.env.REFRESH_COOKIE_NAME || "edunova_refresh"; }
function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth", maxAge: refreshDays() * 24 * 60 * 60 * 1000 };
}
function readCookie(req) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index > 0 && cookie.slice(0, index).trim() === cookieName()) return decodeURIComponent(cookie.slice(index + 1).trim());
  }
  return "";
}
async function createSession(user, req, familyId = crypto.randomUUID()) {
  const rawToken = newRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + refreshDays() * 24 * 60 * 60 * 1000);
  await RefreshSession.create({ user: user._id, tokenHash, familyId, expiresAt, userAgent: String(req.get("user-agent") || "").slice(0, 500), ipAddress: String(req.ip || "").slice(0, 100) });
  return { rawToken, tokenHash, familyId, expiresAt };
}
async function revokeUserSessions(userId, reason = "account_changed") {
  return RefreshSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: reason } });
}
function setRefreshCookie(res, rawToken) { res.cookie(cookieName(), rawToken, cookieOptions()); }
function clearRefreshCookie(res) { const { maxAge: _maxAge, ...options } = cookieOptions(); res.clearCookie(cookieName(), options); }

module.exports = { RefreshSession, accessToken, clearRefreshCookie, cookieName, cookieOptions, createSession, hashToken, publicUser, readCookie, revokeUserSessions, setRefreshCookie };

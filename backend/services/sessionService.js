const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const PlatformSetting = require("../models/PlatformSetting");
const RefreshSession = require("../models/RefreshSession");

class SessionRejection extends Error {
  constructor(message) { super(message); this.name = "SessionRejection"; }
}

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, accountStatus: user.accountStatus });
const accessToken = (user, session) => {
  const payload = { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 };
  if (!session) return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" });

  // A refresh must never extend the absolute session deadline. Use an explicit
  // JWT lifetime rather than copying decoded registered claims into a new JWT.
  const secondsRemaining = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);
  if (secondsRemaining < 1) throw new SessionRejection("Session timeout reached. Please log in again.");
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: Math.min(secondsRemaining, durationSeconds(process.env.ACCESS_TOKEN_EXPIRES_IN || "15m")),
  });
};

function durationSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.floor(value));
  const match = String(value).trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) throw new Error("ACCESS_TOKEN_EXPIRES_IN must be a whole number of seconds, minutes, hours, or days");
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  return Math.max(1, Number(match[1]) * units[(match[2] || "s").toLowerCase()]);
}
function sessionDeadline(startedAt, timeoutMinutes, maximumExpiry) {
  const timeout = Number(timeoutMinutes ?? 30);
  if (!Number.isInteger(timeout) || timeout < 1) throw new Error("Invalid session timeout");
  return new Date(Math.min(new Date(startedAt).getTime() + timeout * 60000, new Date(maximumExpiry).getTime()));
}
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
async function createSession(user, req, familyId = crypto.randomUUID(), previous = null, session = null) {
  const rawToken = newRawToken();
  const tokenHash = hashToken(rawToken);
  const settings = await PlatformSetting.findOne({ key: "platform" }).session(session).lean();
  const startedAt = previous?.startedAt || previous?.createdAt || new Date();
  const expiresAt = sessionDeadline(startedAt, settings?.sessionTimeout, previous?.expiresAt || new Date(Date.now() + refreshDays() * 86400000));
  if (expiresAt <= new Date()) throw new SessionRejection("Session timeout reached. Please log in again.");
  await RefreshSession.create([{ user: user._id, tokenHash, familyId, startedAt, expiresAt, userAgent: String(req.get("user-agent") || "").slice(0, 500), ipAddress: String(req.ip || "").slice(0, 100) }], { session });
  return { rawToken, tokenHash, familyId, startedAt, expiresAt };
}

async function rotateSession(rawToken, req) {
  const tokenHash = hashToken(rawToken);
  const result = await mongoose.connection.transaction(async (session) => {
    const existing = await RefreshSession.findOne({ tokenHash }).session(session);
    if (!existing) return { rejection: "Refresh session is invalid" };
    const revokeFamily = (reason) => RefreshSession.updateMany(
      { familyId: existing.familyId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: reason } }, { session }
    );
    if (existing.revokedAt) {
      if (existing.revokeReason === "rotated") await revokeFamily("reuse_detected");
      // Return instead of throwing so replay revocation commits with the rejection.
      return { rejection: "Refresh session has been revoked" };
    }
    if (existing.expiresAt <= new Date()) {
      existing.revokedAt = new Date(); existing.revokeReason = "expired";
      await existing.save({ session });
      return { rejection: "Refresh session has expired" };
    }
    const user = await User.findById(existing.user).session(session);
    if (!user || user.accountStatus !== "approved") {
      await revokeFamily("account_changed");
      return { rejection: "User session is no longer active" };
    }
    const rotated = await RefreshSession.findOneAndUpdate(
      { _id: existing._id, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: "rotated", lastUsedAt: new Date() } },
      { returnDocument: "after", session }
    );
    if (!rotated) {
      await revokeFamily("reuse_detected");
      return { rejection: "Refresh token reuse was detected" };
    }
    const next = await createSession(user, req, existing.familyId, existing, session);
    await RefreshSession.updateOne({ _id: existing._id }, { $set: { replacedByHash: next.tokenHash } }, { session });
    // Signing must also succeed before committing rotation. No cookie is sent
    // from this callback, which MongoDB may retry after a write conflict.
    return { next, token: accessToken(user, next), user: publicUser(user) };
  });
  if (result.rejection) throw new SessionRejection(result.rejection);
  return result;
}
async function revokeUserSessions(userId, reason = "account_changed") {
  return RefreshSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: reason } });
}
function setRefreshCookie(res, rawToken, expiresAt) { res.cookie(cookieName(), rawToken, { ...cookieOptions(), ...(expiresAt ? { maxAge: Math.max(0, new Date(expiresAt).getTime() - Date.now()) } : {}) }); }
function clearRefreshCookie(res) { const { maxAge: _maxAge, ...options } = cookieOptions(); res.clearCookie(cookieName(), options); }

module.exports = { SessionRejection, rotateSession, durationSeconds, sessionDeadline, RefreshSession, accessToken, clearRefreshCookie, cookieName, cookieOptions, createSession, hashToken, publicUser, readCookie, revokeUserSessions, setRefreshCookie };

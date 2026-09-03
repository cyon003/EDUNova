/**
 * OTP Service
 * Generates and stores 6-digit one-time passwords in memory.
 * Each OTP expires after 10 minutes and can only be used once.
 *
 * In production you would store OTPs in Redis instead of memory,
 * so they survive server restarts and work across multiple instances.
 */

const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");

// Map of email → { otp, expiresAt, attempts }
const otpStore = new Map();

const OTP_EXPIRY_MS  = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS   = 5;               // max wrong guesses before lockout

/**
 * Generate a cryptographically random 6-digit OTP.
 */
function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Issue a new OTP for the given email and send it.
 * Returns { sent, reason } matching emailService shape.
 */
async function issueOtp(email) {
  const otp = generateOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  // Overwrite any previous OTP for this email
  otpStore.set(email.toLowerCase(), { otp, expiresAt, attempts: 0 });

  const result = await sendEmail({
    to: email,
    subject: "Your EDUNova payment verification code",
    text: `Your EDUNova verification code is: ${otp}\n\nIt expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#1a1200;color:#f5e6c0;border-radius:16px;border:1px solid rgba(240,164,0,0.2)">
        <h2 style="color:#f0a400;margin-bottom:8px">EDUNova Payment Verification</h2>
        <p style="color:#c9a84c;margin-bottom:24px">Enter this code to complete your purchase:</p>
        <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#f5b913;text-align:center;padding:24px;background:rgba(240,164,0,0.08);border-radius:12px;border:1px solid rgba(240,164,0,0.25)">
          ${otp}
        </div>
        <p style="color:#8a6a1a;font-size:13px;margin-top:20px;text-align:center">
          This code expires in <strong style="color:#f0a400">10 minutes</strong>.<br/>
          Do not share it with anyone.
        </p>
      </div>
    `,
  });

  return result;
}

/**
 * Verify a submitted OTP for the given email.
 * Returns { valid: true } or { valid: false, reason }
 */
function verifyOtp(email, submittedOtp) {
  const key = email.toLowerCase();
  const record = otpStore.get(key);

  if (!record) {
    return { valid: false, reason: "No OTP was requested for this email" };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { valid: false, reason: "OTP has expired. Please request a new one." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { valid: false, reason: "Too many incorrect attempts. Please request a new OTP." };
  }

  if (record.otp !== String(submittedOtp).trim()) {
    record.attempts += 1;
    return { valid: false, reason: `Incorrect code. ${MAX_ATTEMPTS - record.attempts} attempt(s) remaining.` };
  }

  // OTP is correct — consume it immediately so it can't be reused
  otpStore.delete(key);
  return { valid: true };
}

/**
 * Clean up expired OTPs periodically to avoid memory leaks.
 */
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) otpStore.delete(email);
  }
}, 5 * 60 * 1000); // every 5 minutes

module.exports = { issueOtp, verifyOtp };

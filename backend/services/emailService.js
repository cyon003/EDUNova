const nodemailer = require("nodemailer");

const requiredEmailVariables = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASSWORD"];

function emailIsConfigured() {
  return requiredEmailVariables.every((key) => Boolean(process.env[key]));
}

function createTransporter() {
  if (!emailIsConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: String(process.env.EMAIL_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) return { sent: false, reason: "missing_recipient" };
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`Email skipped for ${to}: email environment variables are not configured`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    });
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Email delivery failed for ${to}:`, error.message);
    return { sent: false, reason: "delivery_failed" };
  }
}

function sendCourseDecisionEmail({ to, name, courseName, approved, feedback = "" }) {
  const decision = approved ? "approved" : "rejected";
  const feedbackText = approved ? "" : ` Feedback: ${feedback}`;
  return sendEmail({
    to,
    subject: `Your EDUNOVA course was ${decision}`,
    text: `Hello ${name || "Tutor"}, your course "${courseName}" was ${decision}.${feedbackText}`,
    html: `<p>Hello ${escapeHtml(name || "Tutor")},</p><p>Your course <strong>${escapeHtml(courseName)}</strong> was ${decision}.</p>${approved ? "" : `<p><strong>Feedback:</strong> ${escapeHtml(feedback)}</p>`}`,
  });
}

function sendTutorApplicationEmail({ to, name, status, reason = "" }) {
  const readableStatus = status.toLowerCase().replaceAll("_", " ");
  return sendEmail({
    to,
    subject: `EDUNOVA tutor application: ${readableStatus}`,
    text: `Hello ${name || "Applicant"}, your tutor application status is now ${readableStatus}.${reason ? ` Reason: ${reason}` : ""}`,
    html: `<p>Hello ${escapeHtml(name || "Applicant")},</p><p>Your tutor application status is now <strong>${escapeHtml(readableStatus)}</strong>.</p>${reason ? `<p><strong>Details:</strong> ${escapeHtml(reason)}</p>` : ""}`,
  });
}

function sendAccountStatusEmail({ to, name, accountStatus }) {
  return sendEmail({
    to,
    subject: `EDUNOVA account ${accountStatus}`,
    text: `Hello ${name || "User"}, your EDUNOVA account is now ${accountStatus}.`,
    html: `<p>Hello ${escapeHtml(name || "User")},</p><p>Your EDUNOVA account is now <strong>${escapeHtml(accountStatus)}</strong>.</p>`,
  });
}

function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes = 15 }) {
  return sendEmail({
    to,
    subject: "Reset your EDUNOVA password",
    text: `Hello ${name || "User"}, use this link to reset your password within ${expiresInMinutes} minutes: ${resetUrl}. If you did not request this, ignore this email.`,
    html: `<p>Hello ${escapeHtml(name || "User")},</p><p>Use the link below to reset your EDUNOVA password. It expires in ${expiresInMinutes} minutes.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

module.exports = {
  emailIsConfigured,
  sendEmail,
  sendCourseDecisionEmail,
  sendTutorApplicationEmail,
  sendAccountStatusEmail,
  sendPasswordResetEmail,
};

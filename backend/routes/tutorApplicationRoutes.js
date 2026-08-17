const express = require("express");
const TutorApplication = require("../models/TutorApplication");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole("tutor"));

const editableFields = ["legalName", "profilePhotoUrl", "bio", "subjects", "educationLevel", "degree", "fieldOfStudy", "institution", "graduationYear", "teachingExperienceYears", "professionalExperience", "certifications", "portfolioUrl", "linkedInUrl", "identityDocumentUrl", "credentialDocumentUrls"];
const cleanList = (value) => Array.isArray(value) ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))] : [];
const isValidUrl = (value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
};

function buildUpdate(body) {
  const update = {};
  editableFields.forEach((field) => {
    if (body[field] === undefined) return;
    update[field] = ["subjects", "certifications", "credentialDocumentUrls"].includes(field) ? cleanList(body[field]) : body[field];
  });
  return update;
}

router.get("/me", async (req, res) => {
  try {
    const application = await TutorApplication.findOne({ tutor: req.user._id }).populate("reviewedBy", "name email");
    return res.json(application || { tutor: req.user._id, legalName: req.user.name, status: "incomplete" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load tutor application", error: error.message });
  }
});

router.put("/me", async (req, res) => {
  try {
    const existing = await TutorApplication.findOne({ tutor: req.user._id });
    if (existing && ["pending_review", "verified", "suspended"].includes(existing.status)) return res.status(409).json({ message: "This application cannot be edited in its current status" });
    const update = buildUpdate(req.body);
    update.status = "incomplete";
    update.decisionReason = "";
    const application = await TutorApplication.findOneAndUpdate(
      { tutor: req.user._id },
      { $set: update, $setOnInsert: { tutor: req.user._id, legalName: req.body.legalName || req.user.name } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await User.findByIdAndUpdate(req.user._id, { tutorVerificationStatus: "incomplete" });
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ message: "Unable to save tutor application", error: error.message });
  }
});

router.post("/submit", async (req, res) => {
  try {
    const application = await TutorApplication.findOne({ tutor: req.user._id });
    if (!application) return res.status(400).json({ message: "Save your application before submitting" });
    if (["pending_review", "verified", "suspended"].includes(application.status)) return res.status(409).json({ message: "This application cannot be submitted in its current status" });
    const required = [application.legalName, application.profilePhotoUrl, application.bio, application.subjects.length, application.educationLevel, application.degree, application.fieldOfStudy, application.institution, application.graduationYear, application.professionalExperience, application.certifications.length, application.portfolioUrl, application.linkedInUrl, application.identityDocumentUrl, application.credentialDocumentUrls.length];
    if (required.some((value) => !value)) return res.status(400).json({ message: "Complete every required profile, education, experience, certification, portfolio, and document field before submitting" });
    const urls = [application.profilePhotoUrl, application.portfolioUrl, application.linkedInUrl, application.identityDocumentUrl, ...application.credentialDocumentUrls];
    if (urls.some((url) => !isValidUrl(url))) return res.status(400).json({ message: "Profile, portfolio, LinkedIn, identity, and credential links must be valid HTTP or HTTPS URLs" });
    application.status = "pending_review";
    application.submittedAt = new Date();
    application.decisionReason = "";
    await application.save();
    await User.findByIdAndUpdate(req.user._id, { tutorVerificationStatus: "pending_review" });
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ message: "Unable to submit tutor application", error: error.message });
  }
});

module.exports = router;

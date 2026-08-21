const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const TutorApplication = require("../models/TutorApplication");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();
const applicantOnly = [authenticateToken, requireRole("student", "tutor")];
const uploadDirectory = path.join(__dirname, "..", "uploads", "tutor-applications");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedDocumentTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = allowedImageTypes.has(file.mimetype) || allowedDocumentTypes.has(file.mimetype);
    if (!allowed) return callback(new Error("Upload a PDF, DOC, DOCX, JPG, PNG, or WebP file"));
    return callback(null, true);
  },
});
const receiveDocuments = upload.fields([{ name: "cv", maxCount: 1 }, { name: "certificate", maxCount: 1 }, { name: "identityPhoto", maxCount: 1 }]);
const editableFields = ["fullName", "email", "phoneNumber", "identityType", "identityNumber", "expertise", "teachingLevel", "teachingExperience", "introduction", "institution", "major", "educationLevel", "motivation"];
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const fileDetails = (file) => file ? ({ originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype, size: file.size }) : null;

function publicApplication(application) {
  const value = application.toObject ? application.toObject() : application;
  delete value.trackingTokenHash;
  return value;
}

function buildUpdate(req) {
  const update = { confirmed: req.body.confirmed === "true" || req.body.confirmed === true, status: "DRAFT", decisionReason: "" };
  editableFields.forEach((field) => {
    if (req.body[field] !== undefined) update[field] = String(req.body[field]).trim();
  });
  if (update.email) update.email = update.email.toLowerCase();
  if (req.files?.cv?.[0]) update.cv = fileDetails(req.files.cv[0]);
  if (req.files?.certificate?.[0]) update.certificate = fileDetails(req.files.certificate[0]);
  if (req.files?.identityPhoto?.[0]) update.identityPhoto = fileDetails(req.files.identityPhoto[0]);
  return update;
}

async function findTrackedApplication(req, res) {
  const token = req.get("X-Application-Token");
  const application = await TutorApplication.findById(req.params.applicationId).select("+trackingTokenHash");
  if (!application) {
    res.status(404).json({ message: "Application not found" });
    return null;
  }
  if (application.applicant && String(application.applicant) !== String(req.user._id)) {
    res.status(403).json({ message: "You do not have permission to access this application" });
    return null;
  }
  if (!application.applicant && (!token || application.trackingTokenHash !== hashToken(token))) {
    res.status(401).json({ message: "Your application tracking key is missing or invalid" });
    return null;
  }
  return application;
}

router.get("/mine", ...applicantOnly, async (req, res) => {
  try {
    const applications = await TutorApplication.find({ applicant: req.user._id }).sort({ submittedAt: -1, createdAt: -1 });
    return res.json(applications.map(publicApplication));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load tutor applications", error: error.message });
  }
});

router.post("/applications", ...applicantOnly, receiveDocuments, async (req, res) => {
  try {
    const update = buildUpdate(req);
    if (!update.fullName || !update.email) return res.status(400).json({ message: "Full name and email are required to save an application" });
    const trackingToken = crypto.randomBytes(32).toString("hex");
    const application = await TutorApplication.create({ ...update, applicant: req.user._id, trackingTokenHash: hashToken(trackingToken) });
    return res.status(201).json({ application: publicApplication(application), trackingToken });
  } catch (error) {
    return res.status(500).json({ message: "Unable to save tutor application", error: error.message });
  }
});

router.get("/applications/:applicationId", ...applicantOnly, async (req, res) => {
  try {
    const application = await findTrackedApplication(req, res);
    if (!application) return undefined;
    return res.json(publicApplication(application));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load tutor application", error: error.message });
  }
});

router.put("/applications/:applicationId", ...applicantOnly, receiveDocuments, async (req, res) => {
  try {
    const application = await findTrackedApplication(req, res);
    if (!application) return undefined;
    Object.assign(application, buildUpdate(req));
    await application.save();
    return res.json(publicApplication(application));
  } catch (error) {
    return res.status(500).json({ message: "Unable to save tutor application", error: error.message });
  }
});

router.post("/applications/:applicationId/submit", ...applicantOnly, async (req, res) => {
  try {
    const application = await findTrackedApplication(req, res);
    if (!application) return undefined;
    if (["UNDER_REVIEW", "APPROVED"].includes(application.status)) return res.status(409).json({ message: "This application cannot be submitted in its current status" });
    const required = [application.fullName, application.email, application.phoneNumber, application.identityType, application.identityNumber, application.identityPhoto, application.expertise, application.teachingLevel, application.teachingExperience, application.introduction, application.institution, application.major, application.educationLevel, application.cv, application.motivation, application.confirmed];
    if (required.some((value) => !value)) return res.status(400).json({ message: "Complete every required field, upload your CV and identity photo, and confirm the information before submitting" });
    application.status = "UNDER_REVIEW";
    application.submittedAt = new Date();
    application.decisionReason = "";
    await application.save();
    return res.json(publicApplication(application));
  } catch (error) {
    return res.status(500).json({ message: "Unable to submit tutor application", error: error.message });
  }
});

router.delete("/applications/:applicationId", ...applicantOnly, async (req, res) => {
  try {
    const application = await findTrackedApplication(req, res);
    if (!application) return undefined;
    for (const document of [application.cv, application.certificate, application.identityPhoto]) {
      if (document?.storedName) fs.unlink(path.join(uploadDirectory, document.storedName), () => {});
    }
    await application.deleteOne();
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ message: "Unable to discard tutor application", error: error.message });
  }
});

router.get("/documents/:applicationId/:kind", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "You do not have permission" });
    if (!["cv", "certificate", "identityPhoto"].includes(req.params.kind)) return res.status(404).json({ message: "Document not found" });
    const application = await TutorApplication.findById(req.params.applicationId);
    const document = application?.[req.params.kind];
    if (!document?.storedName) return res.status(404).json({ message: "Document not found" });
    return res.download(path.join(uploadDirectory, document.storedName), document.originalName);
  } catch (error) {
    return res.status(500).json({ message: "Unable to download document", error: error.message });
  }
});

router.use((error, _req, res, _next) => res.status(400).json({ message: error.message }));

module.exports = router;

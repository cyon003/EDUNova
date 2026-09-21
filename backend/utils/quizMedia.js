const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { uploadDirectory } = require("../config/storage");

// Files a tutor may attach to a quiz question. SVG and HTML are deliberately
// absent: they can carry scripts.
const QUIZ_MEDIA_TYPES = {
  ".jpg": { mime: "image/jpeg", kind: "image" },
  ".jpeg": { mime: "image/jpeg", kind: "image" },
  ".png": { mime: "image/png", kind: "image" },
  ".gif": { mime: "image/gif", kind: "image" },
  ".webp": { mime: "image/webp", kind: "image" },
  ".mp3": { mime: "audio/mpeg", kind: "audio" },
  ".wav": { mime: "audio/wav", kind: "audio" },
  ".m4a": { mime: "audio/mp4", kind: "audio" },
  ".ogg": { mime: "audio/ogg", kind: "audio" },
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

// Stored names look like <courseId>-<uuid>.<ext>. The server is the only thing
// that creates them, and only after checking the tutor owns that course, so a
// name that starts with a course id proves it was uploaded for that course.
const STORED_NAME = /^([0-9a-f]{24})-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(\.[a-z0-9]+)$/;

const quizMediaDirectory = () => uploadDirectory("quiz-media");

function newStoredName(courseId, originalName) {
  return `${courseId}-${crypto.randomUUID()}${path.extname(String(originalName || "")).toLowerCase()}`;
}

// Resolves a stored name to a file path, or throws for anything suspicious.
function safeQuizMediaPath(storedName) {
  if (typeof storedName !== "string" || !STORED_NAME.test(storedName) || path.basename(storedName) !== storedName) throw new Error("unsafe_path");
  const directory = quizMediaDirectory();
  const resolved = path.resolve(directory, storedName);
  if (!resolved.startsWith(`${directory}${path.sep}`)) throw new Error("unsafe_path");
  return resolved;
}

// Validates a question's attachment as sent by the browser. Only storedName and
// originalName are trusted from the request; the type and size come from the
// server, so a client cannot choose the Content-Type a file is served with.
function describeQuizMedia(input, courseId) {
  if (input === undefined || input === null || input === "") return { media: null };
  if (typeof input !== "object" || Array.isArray(input)) return { error: "attachment is invalid" };

  const match = STORED_NAME.exec(String(input.storedName || ""));
  if (!courseId || !match || match[1] !== String(courseId)) return { error: "attachment does not belong to this course" };
  const type = QUIZ_MEDIA_TYPES[match[2]];
  if (!type) return { error: "attachment type is not supported" };

  let size;
  try { size = fs.statSync(safeQuizMediaPath(input.storedName)).size; } catch { return { error: "attachment file is missing, upload it again" }; }

  const originalName = String(input.originalName || "").trim().slice(0, 200) || input.storedName;
  return { media: { originalName, storedName: input.storedName, mimeType: type.mime, size, kind: type.kind } };
}

// Streams an attachment with a server-chosen Content-Type. Callers must have
// already checked that the requester may see it.
function sendQuizMediaFile(res, storedName, mimeType) {
  let filePath;
  try { filePath = safeQuizMediaPath(storedName); } catch { return res.status(404).json({ message: "Attachment not found" }); }
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Attachment not found" });
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.sendFile(filePath);
}

function quizMediaNames(quiz) {
  return (quiz?.questions || []).map((question) => question?.media?.storedName).filter(Boolean);
}

function deleteQuizMediaFiles(storedNames) {
  for (const storedName of storedNames) {
    try { fs.unlink(safeQuizMediaPath(storedName), () => {}); } catch { /* Never follow an invalid name. */ }
  }
}

module.exports = { sendQuizMediaFile, QUIZ_MEDIA_TYPES, MAX_IMAGE_BYTES, MAX_AUDIO_BYTES, newStoredName, safeQuizMediaPath, describeQuizMedia, quizMediaNames, deleteQuizMediaFiles, quizMediaDirectory };

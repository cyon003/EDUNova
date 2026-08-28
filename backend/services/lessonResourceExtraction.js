const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const Course = require("../models/Course");
const LessonResourceChunk = require("../models/LessonResourceChunk");

const RESOURCE_DIRECTORY = path.resolve(__dirname, "..", "uploads", "lesson-resources");
const SEARCHABLE_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
]);

function positiveInteger(name, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) ? Math.min(Math.max(value, minimum), maximum) : fallback;
}

function extractionLimits() {
  return {
    maxFileBytes: positiveInteger("RESOURCE_EXTRACTION_MAX_FILE_BYTES", 15 * 1024 * 1024),
    maxExtractedCharacters: positiveInteger("RESOURCE_EXTRACTION_MAX_CHARACTERS", 200000),
    maxChunks: positiveInteger("RESOURCE_EXTRACTION_MAX_CHUNKS", 200, 1, 1000),
    chunkSize: positiveInteger("RESOURCE_EXTRACTION_CHUNK_SIZE", 1200, 200, 5000),
  };
}

function searchableContentType(resource) {
  const extension = path.extname(String(resource.originalName || "")).toLowerCase();
  const expected = SEARCHABLE_TYPES.get(extension);
  if (!expected) return null;
  if (extension === ".txt" && ["text/plain", "application/octet-stream"].includes(resource.mimeType)) return expected;
  return resource.mimeType === expected ? expected : null;
}

function safeResourcePath(storedName) {
  if (typeof storedName !== "string" || !storedName || path.basename(storedName) !== storedName) throw new Error("unsafe_path");
  const resolved = path.resolve(RESOURCE_DIRECTORY, storedName);
  if (!resolved.startsWith(`${RESOURCE_DIRECTORY}${path.sep}`)) throw new Error("unsafe_path");
  return resolved;
}

async function validateSearchableFile(resource, filePath) {
  if (!searchableContentType(resource)) return true;
  const handle = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(8);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const extension = path.extname(resource.originalName).toLowerCase();
    if (extension === ".pdf") return header.subarray(0, bytesRead).toString("ascii").startsWith("%PDF-");
    if (extension === ".docx") return header[0] === 0x50 && header[1] === 0x4b;
    return !header.subarray(0, bytesRead).includes(0);
  } finally { await handle.close(); }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitBoundedText(text, chunkSize) {
  const paragraphs = text.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const pieces = paragraph.length > chunkSize ? paragraph.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, "g")) : [paragraph];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 1 > chunkSize) { chunks.push(current); current = ""; }
      current = `${current} ${piece}`.trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function extractPdf(buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({ data: new Uint8Array(buffer), disableWorker: true, useSystemFonts: true });
  const document = await loadingTask.promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push({ pageNumber, text: textContent.items.map((item) => typeof item.str === "string" ? item.str : "").join(" ") });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages;
}

async function extractDocumentPages(resource, buffer) {
  const extension = path.extname(resource.originalName).toLowerCase();
  if (extension === ".pdf") return extractPdf(buffer);
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return [{ pageNumber: null, text: result.value }];
  }
  if (extension === ".txt") {
    if (buffer.includes(0)) throw new Error("invalid_text_file");
    return [{ pageNumber: null, text: buffer.toString("utf8") }];
  }
  throw new Error("unsupported_type");
}

async function buildChunks(resource, filePath) {
  const limits = extractionLimits();
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) throw new Error("missing_file");
  if (stat.size > limits.maxFileBytes) throw new Error("file_too_large");
  const buffer = await fs.promises.readFile(filePath);
  const pages = await extractDocumentPages(resource, buffer);
  let remainingCharacters = limits.maxExtractedCharacters;
  const chunks = [];
  for (const page of pages) {
    if (remainingCharacters <= 0 || chunks.length >= limits.maxChunks) break;
    const normalized = normalizeText(page.text).slice(0, remainingCharacters);
    remainingCharacters -= normalized.length;
    for (const content of splitBoundedText(normalized, limits.chunkSize)) {
      if (chunks.length >= limits.maxChunks) break;
      chunks.push({ content, pageNumber: page.pageNumber });
    }
  }
  if (!chunks.length) throw new Error("empty_document");
  return chunks;
}

const SAFE_FAILURES = {
  empty_document: "No searchable text was found in this file.",
  file_too_large: "The file exceeds the extraction size limit.",
  invalid_text_file: "The text file is not valid plain text.",
  missing_file: "The uploaded file could not be found.",
  unsafe_path: "The stored resource path is invalid.",
  unsupported_type: "This file format is not supported for text extraction.",
};

async function updateResourceStatus(courseId, lessonId, resourceId, values) {
  const set = {};
  Object.entries(values).forEach(([key, value]) => { set[`lessons.$[lesson].resources.$[resource].${key}`] = value; });
  await Course.updateOne(
    { _id: courseId },
    { $set: set },
    { arrayFilters: [{ "lesson._id": lessonId }, { "resource._id": resourceId }] }
  );
}

async function processResourceExtraction({ courseId, lessonId, resourceId }) {
  const course = await Course.findById(courseId);
  const lesson = course?.lessons.id(lessonId);
  const resource = lesson?.resources.id(resourceId);
  if (!course || !lesson || !resource) return { status: "missing" };
  const contentType = searchableContentType(resource);
  if (!contentType) return { status: "unsupported" };

  await updateResourceStatus(course._id, lesson._id, resource._id, { extractionStatus: "processing", extractionFailureReason: "" });
  try {
    const chunks = await buildChunks(resource, safeResourcePath(resource.storedName));
    await LessonResourceChunk.bulkWrite(chunks.map((chunk, index) => ({
      updateOne: {
        filter: { resource: resource._id, chunkNumber: index + 1 },
        update: { $set: { course: course._id, lesson: lesson._id, resource: resource._id, tutor: course.tutor, originalFilename: resource.originalName, contentType, chunkNumber: index + 1, pageNumber: chunk.pageNumber, content: chunk.content } },
        upsert: true,
      },
    })), { ordered: true });
    await LessonResourceChunk.deleteMany({ resource: resource._id, chunkNumber: { $gt: chunks.length } });
    await updateResourceStatus(course._id, lesson._id, resource._id, { extractionStatus: "completed", extractionFailureReason: "", extractedAt: new Date(), extractedChunkCount: chunks.length });
    return { status: "completed", chunkCount: chunks.length };
  } catch (error) {
    const reason = error.code === "ENOENT" ? SAFE_FAILURES.missing_file : SAFE_FAILURES[error.message] || "Text extraction failed for this resource.";
    await updateResourceStatus(course._id, lesson._id, resource._id, { extractionStatus: "failed", extractionFailureReason: reason, extractedAt: null, extractedChunkCount: 0 });
    return { status: "failed", reason };
  }
}

module.exports = { RESOURCE_DIRECTORY, SEARCHABLE_TYPES, extractionLimits, searchableContentType, safeResourcePath, validateSearchableFile, normalizeText, splitBoundedText, buildChunks, processResourceExtraction };

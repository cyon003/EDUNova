const path = require("node:path");
const mediaExtensions = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|m4a|ogg)$/i;
function legacyStoredName(url) {
  try { return path.basename(new URL(url).pathname); } catch { return path.basename(String(url || "")); }
}

function legacyMediaType(storedName) {
  const extension = path.extname(storedName).toLowerCase();
  return ({ ".webm": "video/webm", ".ogv": "video/ogg", ".ogg": "video/ogg", ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4" })[extension] || "video/mp4";
}

function primaryMediaFor(lesson) {
  if (lesson.primaryMedia?.storedName) return lesson.primaryMedia;
  if (lesson.primaryMediaRemoved) return null;
  const resource = lesson.resources?.find((item) => /^(video|audio)\//i.test(item.mimeType || "") || mediaExtensions.test(item.originalName || ""));
  if (resource) return { ...(typeof resource.toObject === "function" ? resource.toObject() : resource), storage: "lesson-resources", resourceId: resource._id };
  if (String(lesson.videoUrl || "").includes("/uploads/course-videos/")) {
    const storedName = legacyStoredName(lesson.videoUrl);
    return { originalName: storedName, storedName, mimeType: legacyMediaType(storedName), size: 0, storage: "course-videos" };
  }
  return null;
}

module.exports = { primaryMediaFor };

const MEDIA_EXTENSION = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|m4a|ogg)$/i;
const PREVIEW_EXTENSION = /\.(pdf|txt|jpg|jpeg|png|gif|webp)$/i;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

export function isYouTubeUrl(value) {
  try { return YOUTUBE_HOSTS.has(new URL(String(value || "")).hostname.toLowerCase()); } catch { return false; }
}

export function getYouTubeEmbedUrl(value) {
  if (!isYouTubeUrl(value)) return null;
  const url = new URL(value);
  const id = url.hostname.endsWith("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");
  return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? `https://www.youtube.com/embed/${id}` : null;
}

export function isMediaResource(resource) {
  return /^(video|audio)\//i.test(String(resource?.mimeType || "")) || MEDIA_EXTENSION.test(String(resource?.originalName || ""));
}

export function getLessonPrimaryMedia(lesson) {
  if (lesson?.primaryMedia?.storedName) return lesson.primaryMedia;
  if (lesson?.primaryMediaRemoved) return null;
  const legacyResource = (lesson?.resources || []).find(isMediaResource);
  if (legacyResource) return { ...legacyResource, storage: "lesson-resources", resourceId: legacyResource._id };
  if (String(lesson?.videoUrl || "").includes("/uploads/course-videos/")) return { originalName: "Lesson video", mimeType: "video/mp4", legacy: true };
  return null;
}

export function lessonReferences(lesson) {
  const references = Array.isArray(lesson?.references) ? [...lesson.references] : [];
  const legacyUrl = String(lesson?.videoUrl || "").trim();
  if (/^https?:\/\//i.test(legacyUrl) && !legacyUrl.includes("/uploads/course-videos/") && !references.some((item) => item.url === legacyUrl)) {
    let label = "Reference";
    try { label = new URL(legacyUrl).hostname; } catch { /* Keep the generic label. */ }
    references.push({ label, url: legacyUrl });
  }
  return references;
}

export function supportingResources(lesson) {
  const primary = getLessonPrimaryMedia(lesson);
  return (lesson?.resources || []).filter((resource) => String(resource._id) !== String(primary?.resourceId || ""));
}

export function canPreviewResource(resource) {
  return /^(image\/|text\/plain|application\/pdf)/i.test(String(resource?.mimeType || "")) || PREVIEW_EXTENSION.test(String(resource?.originalName || ""));
}

export function supportsLessonTranscript(lesson) {
  return Boolean(String(lesson?.transcript || "").trim() && getLessonPrimaryMedia(lesson));
}

export function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 ** 2).toFixed(1)} MB`;
}

export function fileType(resource) {
  const name = String(resource?.originalName || "");
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return extension ? extension.toUpperCase() : String(resource?.mimeType || "File");
}

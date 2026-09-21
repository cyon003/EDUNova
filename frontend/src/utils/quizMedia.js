import { API_ROOT } from "./courseApi";

// Pictures and audio a tutor can attach to a quiz question. The server checks
// all of this again; the checks here only give quick feedback.
const TYPES = { jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio" };
const MAX_BYTES = { image: 5 * 1024 * 1024, audio: 15 * 1024 * 1024 };

export const QUIZ_MEDIA_ACCEPT = Object.keys(TYPES).map((extension) => `.${extension}`).join(",");

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export function checkQuizMediaFile(file) {
  const kind = TYPES[String(file.name.split(".").pop()).toLowerCase()];
  if (!kind) return "Choose a picture (JPG, PNG, GIF, WebP) or an audio file (MP3, WAV, M4A, OGG)";
  if (file.size > MAX_BYTES[kind]) return kind === "image" ? "Pictures can be up to 5 MB" : "Audio can be up to 15 MB";
  return "";
}

export async function uploadQuizMedia(courseId, file) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_ROOT}/tutor/courses/${encodeURIComponent(courseId)}/quiz-media`, { method: "POST", headers: authHeaders(), body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to upload the file");
  return data;
}

// Best effort: the server only deletes files that no saved quiz uses.
export function deleteQuizMedia(courseId, storedName) {
  if (!courseId || !storedName) return;
  fetch(`${API_ROOT}/tutor/courses/${encodeURIComponent(courseId)}/quiz-media/${encodeURIComponent(storedName)}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
}

export const tutorQuizMediaUrl = (courseId, storedName) => `${API_ROOT}/tutor/courses/${encodeURIComponent(courseId)}/quiz-media/${encodeURIComponent(storedName)}`;
export const studentQuizMediaUrl = (courseSlug, lessonIndex, questionId) => `${API_ROOT}/quizzes/${encodeURIComponent(courseSlug)}/lessons/${lessonIndex}/questions/${encodeURIComponent(questionId)}/media`;

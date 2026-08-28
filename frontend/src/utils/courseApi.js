const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
export const API_ROOT = `${API_ORIGIN}/api`;

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load courses");
  return data;
}

export async function getPublicCourses(signal) {
  return readJson(await fetch(`${API_ROOT}/courses`, { signal }));
}

export async function getPublicCourse(slug, signal) {
  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return readJson(await fetch(`${API_ROOT}/courses/${encodeURIComponent(slug)}`, { headers, signal }));
}

export function courseThumbnail(course, fallback) {
  return course?.thumbnail || fallback;
}

export function apiAssetUrl(value) {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value;
  return `${API_ROOT.replace(/\/api$/, "")}${value.startsWith("/") ? value : `/${value}`}`;
}

export function lessonDurationSeconds(lesson) {
  const storedSeconds = Number(lesson?.durationSeconds);
  if (Number.isFinite(storedSeconds) && storedSeconds > 0) return storedSeconds;

  const value = String(lesson?.duration || "").trim().toLowerCase();
  if (!value || value === "provider managed") return 0;

  if (/^\d+(?::\d{1,2}){1,2}$/.test(value)) {
    const parts = value.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  }

  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/)?.[1] || 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/)?.[1] || 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/)?.[1] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function courseDuration(course) {
  const lessons = course?.lessons || [];
  const seconds = lessons.reduce((total, lesson) => total + lessonDurationSeconds(lesson), 0);
  if (seconds > 0) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours}hr ${remainingMinutes} min` : `${hours}hr`;
  }

  const fallback = String(course?.duration || "").trim();
  if (fallback && fallback.toLowerCase() !== "automatically calculated") return fallback;
  return `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"}`;
}

export function formatCoursePrice(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return "Free";
  return `฿${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
}

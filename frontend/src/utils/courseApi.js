export const API_ROOT = "http://localhost:5050/api";

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load courses");
  return data;
}

export async function getPublicCourses(signal) {
  return readJson(await fetch(`${API_ROOT}/courses`, { signal }));
}

export async function getPublicCourse(slug, signal) {
  return readJson(await fetch(`${API_ROOT}/courses/${encodeURIComponent(slug)}`, { signal }));
}

export function courseThumbnail(course, fallback) {
  return course?.thumbnail || fallback;
}

export function courseDuration(course) {
  if (course?.duration) return course.duration;
  const seconds = (course?.lessons || []).reduce((total, lesson) => total + (Number(lesson.durationSeconds) || 0), 0);
  if (!seconds) return `${course?.lessons?.length || 0} lessons`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

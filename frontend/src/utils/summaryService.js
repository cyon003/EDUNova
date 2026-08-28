const STORE_KEY = "edunova-summary-mock-v1";

const readStore = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
};
const writeStore = (store) => localStorage.setItem(STORE_KEY, JSON.stringify(store));
const lessonKey = (course, lesson, index = 0) => `lesson:${course._id || course.slug}:${lesson._id || index}`;
const courseKey = (course) => `course:${course._id || course.slug}`;
const delay = (value) => new Promise((resolve) => window.setTimeout(() => resolve(value), 450));

export const summaryStatuses = ["not_generated", "ready", "generating", "draft", "approved", "outdated", "failed"];

export function lessonSummaryState(course, lesson, index = 0) {
  const saved = readStore()[lessonKey(course, lesson, index)];
  if (saved) return saved;
  const extracted = lesson.resources?.some((resource) => resource.extractionStatus === "completed");
  return { status: extracted ? "ready" : "not_generated", shortSummary: "", detailedSummary: "", keyPoints: [], keywords: [] };
}

export function courseSummaryState(course) {
  return readStore()[courseKey(course)] || { status: "not_generated", overview: "", mainTopics: [], learningOutcomes: [], targetAudience: "", prerequisites: "" };
}

export async function mockGenerateLessonSummary(course, lesson, index = 0) {
  const store = readStore();
  const summary = {
    status: "draft",
    shortSummary: `Development preview for ${lesson.title}. This draft was created by the frontend mock adapter, not Gemini.`,
    detailedSummary: `This temporary summary demonstrates the future review workflow for ${lesson.title}. A real backend will create grounded content from extracted authorized lesson resources.`,
    keyPoints: ["Mock content for interface testing", "Tutor review is required before students can view it"],
    keywords: ["development", "summary", "review"],
    updatedAt: new Date().toISOString(),
    mock: true,
  };
  store[lessonKey(course, lesson, index)] = summary;
  writeStore(store);
  return delay(summary);
}

export async function saveLessonSummary(course, lesson, index, summary) {
  const store = readStore();
  store[lessonKey(course, lesson, index)] = { ...summary, status: "draft", updatedAt: new Date().toISOString(), mock: true };
  writeStore(store);
  return delay(store[lessonKey(course, lesson, index)]);
}

export async function approveLessonSummary(course, lesson, index, summary) {
  if (!summary.shortSummary?.trim() || !summary.detailedSummary?.trim()) throw new Error("Add both summary fields before approval.");
  const store = readStore();
  store[lessonKey(course, lesson, index)] = { ...summary, status: "approved", approvedAt: new Date().toISOString(), mock: true };
  writeStore(store);
  return delay(store[lessonKey(course, lesson, index)]);
}

export async function mockGenerateCourseSummary(course) {
  const store = readStore();
  const summary = { status: "draft", overview: `Development preview summary for ${course.name}.`, mainTopics: course.lessons?.slice(0, 4).map((lesson) => lesson.title) || [], learningOutcomes: ["Review the main ideas from each approved lesson"], targetAudience: course.level || "Learners", prerequisites: "See the course requirements", mock: true };
  store[courseKey(course)] = summary;
  writeStore(store);
  return delay(summary);
}

export async function saveCourseSummary(course, summary, approved = false) {
  if (approved && !summary.overview?.trim()) throw new Error("Add a course overview before approval.");
  const store = readStore();
  store[courseKey(course)] = { ...summary, status: approved ? "approved" : "draft", updatedAt: new Date().toISOString(), mock: true };
  writeStore(store);
  return delay(store[courseKey(course)]);
}

export function saveSummaryToLocalNotes({ userId, course, lesson, lessonIndex, summary }) {
  const key = `edunova-notes-${userId || "student"}`;
  const notes = (() => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  })();
  const now = new Date().toISOString();
  const note = { id: `summary-${Date.now()}`, title: `${lesson.title} summary`, body: [summary.shortSummary, summary.detailedSummary, ...(summary.keyPoints || []).map((point) => `• ${point}`)].filter(Boolean).join("\n\n"), course: course.name, courseId: course._id, courseSlug: course.slug, lessonId: lesson._id, lessonIndex, lessonTitle: lesson.title, sourceType: "saved_from_summary", createdAt: now, updatedAt: now };
  localStorage.setItem(key, JSON.stringify([note, ...notes]));
  return note;
}

export const summaryMockInfo = "Development mock only — no Gemini request or backend persistence.";

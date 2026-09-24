import { parseTopicTime } from "./topicTime.js";
import { validLessonDuration } from "./lessonMetadata.js";

export function topicPayload(topics, duration = null) {
  let previousEnd = 0;
  return (topics || []).map((topic, index) => {
    const start = typeof topic.startTimeSeconds === "string" ? parseTopicTime(topic.startTimeSeconds) : topic.startTimeSeconds;
    const end = typeof topic.endTimeSeconds === "string" ? parseTopicTime(topic.endTimeSeconds) : topic.endTimeSeconds;
    if (!topic.title.trim()) throw new Error(`Topic ${index + 1} needs a title.`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error(`Topic ${index + 1}: use MM:SS with an end after the start.`);
    if (start < previousEnd) throw new Error(`Topic ${index + 1} overlaps the previous topic.`);
    if (duration > 0 && end > duration) throw new Error(`Topic ${index + 1} ends after the lesson media.`);
    previousEnd = end;
    return { ...(topic._id ? { _id: topic._id } : {}), title: topic.title.trim(), startTimeSeconds: start, endTimeSeconds: end };
  });
}

export function lessonSaveRequest(lessonId, values, parseReferences) {
  const { mainVideo, documents = [], referenceLinks, durationSeconds, courseVersion, lessonId: draftLessonId, ...content } = values;
  if (String(draftLessonId) !== String(lessonId)) throw new Error("Lesson selection changed. Select it again.");
  const duration = mainVideo ? durationSeconds : validLessonDuration(content.duration) ? content.duration.split(":").reduce((sum, part) => sum * 60 + Number(part), 0) : null;
  if (mainVideo && (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > 86400)) throw new Error("Wait for a valid media duration before saving.");
  if(content.quiz) content.quiz = {...content.quiz, questions: content.quiz.questions.map(({_editorKey, ...question}) => { void _editorKey; return question; })};
  content.topics = topicPayload(content.topics, duration);
  content.references = parseReferences(referenceLinks);
  if (mainVideo) delete content.duration;
  const headers = { "X-Course-Version": String(courseVersion) };
  if (!mainVideo && !documents.length) return { method: "PATCH", headers, body: JSON.stringify(content) };
  const body = new FormData();
  for (const [key, value] of Object.entries(content)) body.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  if (mainVideo) { body.append("video", mainVideo); body.append("durationSeconds", String(durationSeconds)); }
  documents.forEach(file => body.append("resources", file));
  return { method: "PATCH", headers, body };
}

export function hasLessonEdits(draft, baseline) {
  return Boolean(draft.mainVideo || draft.documents?.length || JSON.stringify(draft) !== JSON.stringify(baseline));
}

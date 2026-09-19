const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const { topicAtTimestamp } = require("../utils/lessonTopics");

// Plain-text transcripts have no timestamp alignment. Use a bounded prefix,
// never a purported timestamp-specific quote (see docs/CONTEXTUAL_AI.md).
const MAX_TRANSCRIPT_CHARACTERS = 8000;
const MAX_DESCRIPTION_CHARACTERS = 1000;
const MAX_SUMMARY_CHARACTERS = 2000;
const bounded = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
function reject(status, publicMessage) { throw Object.assign(new Error("lesson_context_rejected"), { status, publicMessage }); }

function validateLessonInput(input, { history = false } = {}) {
  const allowed = new Set(["mode", "courseId", "lessonId", "videoTimestampSeconds", ...(history ? ["page", "limit"] : ["message"])]);
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.has(key))) reject(400, "Unsupported lesson context field");
  for (const key of ["courseId", "lessonId"]) {
    if (typeof input[key] !== "string" || !mongoose.isObjectIdOrHexString(input[key])) reject(400, `A valid ${key} is required`);
  }
  // Query parameters are strings; request-body timestamps must be JSON numbers.
  const raw = input.videoTimestampSeconds;
  const timestamp = history && typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp < 0) reject(400, "Video timestamp must be a finite non-negative number");
  return timestamp;
}

async function resolveLessonContext(user, input, options) {
  if (user.role !== "student") reject(403, "Lesson AI requires student access");
  const timestamp = validateLessonInput(input, options);
  const course = await Course.findById(input.courseId).select("name lessons");
  if (!course) reject(404, "Course not found");
  // Match the existing enrolled-student access policy; check before revealing lesson metadata.
  const enrollment = await Enrollment.findOne({ student: user._id, course: course._id });
  if (!enrollment) reject(403, "Enroll in this course before using lesson AI");
  const lesson = course.lessons.id(input.lessonId);
  if (!lesson) reject(404, "Lesson not found in this course");
  const topic = topicAtTimestamp(lesson, timestamp);
  const context = {
    courseTitle: bounded(course.name, 200), lessonTitle: bounded(lesson.title, 200),
    topicTitle: topic ? bounded(topic.title, 200) : null, videoTimestampSeconds: timestamp,
  };
  const transcript = typeof lesson.transcript === "string" ? lesson.transcript.trim() : "";
  return {
    metadata: context,
    scope: { user: user._id, mode: "lesson", course: course._id, lessonId: lesson._id, topicId: topic?._id || null },
    record: { course: course._id, lessonId: lesson._id, videoTimestampSeconds: timestamp, topicId: topic?._id || null, topicTitle: context.topicTitle },
    material: {
      ...context,
      description: bounded(lesson.description, MAX_DESCRIPTION_CHARACTERS),
      summary: bounded(lesson.summary, MAX_SUMMARY_CHARACTERS),
      transcriptExcerpt: transcript.slice(0, MAX_TRANSCRIPT_CHARACTERS),
      transcriptTruncated: transcript.length > MAX_TRANSCRIPT_CHARACTERS,
      transcriptAlignment: "Plain text; no timestamp alignment. This excerpt is not evidence of what was said at the current video position.",
    },
  };
}
module.exports = { resolveLessonContext, validateLessonInput, MAX_TRANSCRIPT_CHARACTERS, MAX_DESCRIPTION_CHARACTERS, MAX_SUMMARY_CHARACTERS };

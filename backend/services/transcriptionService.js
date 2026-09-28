const crypto = require("crypto");
const Job = require("../models/TranscriptionJob");
// Persist this intent in the same save as media. The worker reconciles missed enqueues.
function setTranscriptionSource(lesson) {
  const media = lesson.primaryMedia;
  lesson.transcriptionSource = media?.storedName && /^video\//i.test(media.mimeType || "")
    ? { mediaVersion: crypto.randomUUID(), storage: media.storage, storedName: media.storedName }
    : undefined;
}
async function queueTranscription(course, lesson) {
  const source = lesson.transcriptionSource;
  if (!source?.mediaVersion || Job.db.readyState !== 1) return;
  try {
    await Job.updateOne({ course: course._id, lessonId: lesson._id, mediaVersion: source.mediaVersion },
      { $setOnInsert: { storage: source.storage, storedName: source.storedName, status: "queued", attempts: 0, availableAt: new Date() } }, { upsert: true, timeoutMS: 2000 });
  } catch (error) {
    // Never turn a successfully persisted upload into an error/cleanup path.
    console.error("Transcription enqueue deferred to reconciliation:", error.code || "database_unavailable");
  }
}
module.exports = { setTranscriptionSource, queueTranscription };

const express = require("express");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const Job = require("../models/TranscriptionJob");
const Segment = require("../models/TranscriptSegment");
const fs = require("node:fs/promises");
const path = require("node:path");
const { uploadRoot } = require("../config/storage");
const { primaryMediaFor } = require("../utils/primaryMedia");
const { mediaFile } = require("../services/mediaRecoveryService");
const { assertCourseVersion } = require("../services/curriculumGuard");
const { setTranscriptionSource, queueTranscription } = require("../services/transcriptionService");
const router = express.Router();
router.use(require("../middleware/authMiddleware"));
router.use(require("../middleware/roleMiddleware")("tutor"));
router.post("/:courseId/lessons/:lessonId/transcription", async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    if (![courseId, lessonId].every(mongoose.isObjectIdOrHexString)) return res.status(400).json({ message: "Invalid course or lesson" });
    const course = await Course.findOne({ _id: courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    assertCourseVersion(req, course);
    const media = !lesson.primaryMediaRemoved && primaryMediaFor(lesson);
    if (!media || !/^video\//i.test(media.mimeType || "") || !["course-videos", "lesson-resources"].includes(media.storage) || !mediaFile(media.storage, media.storedName)) {
      return res.status(422).json({ message: "This lesson has no supported local main video. External links and audio cannot be transcribed here." });
    }
    // Check the same local file used by the worker; never fetch an external URL.
    const root = await fs.realpath(uploadRoot());
    const file = path.join(root, media.storage, media.storedName);
    try {
      const resolved = await fs.realpath(file);
      if (!resolved.startsWith(`${root}${path.sep}`) || !(await fs.lstat(file)).isFile()) throw new Error("unsafe_file");
      await fs.access(file, fs.constants.R_OK);
    } catch {
      return res.status(422).json({ message: "The original video file is unavailable on this server. Ask an administrator to restore the file in the shared upload directory before generating." });
    }
    const source = lesson.transcriptionSource;
    if (!source?.mediaVersion || source.storedName !== media.storedName || source.storage !== media.storage) {
      // Promote only legacy metadata, preserving the existing file and all content.
      if (!lesson.primaryMedia?.storedName) lesson.primaryMedia = media;
      setTranscriptionSource(lesson);
      await course.save(); // optimistic concurrency rejects replacement/edit races
    }
    await queueTranscription(course, lesson); // unique identity, never reset completed/active jobs
    const job = await Job.findOne({ course: courseId, lessonId, mediaVersion: lesson.transcriptionSource.mediaVersion }).lean();
    return res.status(202).json({ status: job?.status || "queued", mediaVersion: lesson.transcriptionSource.mediaVersion, courseVersion: course.__v, generationRequested: true });
  } catch (error) {
    return res.status(error.status || (error.name === "VersionError" ? 409 : 503)).json({ message: error.status ? error.message : error.name === "VersionError" ? "The lesson changed. Reload before generating." : "Unable to request transcription. Refresh status before retrying." });
  }
});
router.get("/:courseId/lessons/:lessonId/transcription", async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    if (![courseId, lessonId].every(mongoose.isObjectIdOrHexString)) return res.status(400).json({ message: "Invalid course or lesson" });
    const course = await Course.findOne({ _id: courseId, tutor: req.user._id });
    const lesson = course?.lessons.id(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    const source = lesson.transcriptionSource;
    if (!source?.mediaVersion || lesson.primaryMediaRemoved || lesson.primaryMedia?.storedName !== source.storedName || lesson.primaryMedia?.storage !== source.storage) return res.json({ status: "not_requested", segments: [] });
    const job = await Job.findOne({ course: courseId, lessonId, mediaVersion: source.mediaVersion }).lean();
    if (!job) return res.json({ status: "queued", mediaVersion: source.mediaVersion, segments: [] });
    const offset = Number(req.query.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ message: "Invalid offset" });
    const segments = job.status === "completed" ? await Segment.find({ jobId: job._id, resultToken: job.resultToken, index: { $gte: offset } }).sort({ index: 1 }).limit(200).select("-_id index startTimeSeconds endTimeSeconds text").lean() : [];
    return res.json({ status: job.status, mediaVersion: source.mediaVersion, attempts: job.attempts, errorCode: job.errorCode || null, language: job.language, modelRevision: job.modelRevision, segmentCount: job.segmentCount, completedAt: job.completedAt, segments, nextOffset: offset + segments.length < (job.segmentCount || 0) ? offset + segments.length : null });
  } catch { return res.status(503).json({ message: "Transcription is temporarily unavailable" }); }
});
module.exports = router;

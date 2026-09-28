const express = require('express');
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Transcription = require('../models/TranscriptionJob');
const Suggestion = require('../models/TopicSuggestion');
const { topicFields } = require('../utils/lessonTopics');
const { statedDurationSeconds } = require('../services/lessonWatchService');
const { assertCourseVersion } = require('../services/curriculumGuard');
const router = express.Router();
router.use(require('../middleware/authMiddleware'));
router.use(require('../middleware/roleMiddleware')('tutor'));
const route = '/:courseId/lessons/:lessonId/topic-suggestions';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

async function target(req, session = null) {
  const { courseId, lessonId } = req.params;
  if (![courseId, lessonId].every(mongoose.isObjectIdOrHexString)) fail(400, 'Invalid course or lesson');
  const course = await Course.findOne({ _id: courseId, tutor: req.user._id }).session(session);
  const lesson = course?.lessons.id(lessonId);
  if (!lesson) fail(404, 'Lesson not found');
  const source = lesson.transcriptionSource;
  const current = source?.mediaVersion && !lesson.primaryMediaRemoved &&
    lesson.primaryMedia?.storedName === source.storedName && lesson.primaryMedia?.storage === source.storage;
  const transcript = current ? await Transcription.findOne({ course: courseId, lessonId,
    mediaVersion: source.mediaVersion, status: 'completed' }).session(session) : null;
  return { course, lesson, transcript };
}
function publicSuggestion(job) {
  return { suggestionId: job._id, mediaVersion: job.mediaVersion, status: job.status,
    modelRevision: job.modelRevision, algorithmVersion: job.algorithmVersion,
    generatedTopics: job.generatedTopics, draftTopics: job.draftTopics, provenance: job.provenance,
    reviewStatus: job.reviewStatus, reviewRevision: job.reviewRevision, acceptedTopicIds: job.acceptedTopicIds,
    attempts: job.attempts, errorCode: job.errorCode || null, completedAt: job.completedAt };
}
function sendError(res, error) {
  return res.status(error.status || (error.name === 'VersionError' ? 409 : 503))
    .json({ message: error.status ? error.message : 'Unable to save suggestions safely. Reload and retry.' });
}
router.get(route, async (req, res) => {
  try {
    let result;
    await mongoose.connection.transaction(async session => {
      const { course, transcript } = await target(req, session);
      if (!transcript) { result = { status: 'awaiting_transcript', courseVersion: course.__v }; return; }
      const job = await Suggestion.findOne({ transcriptionJobId: transcript._id,
        transcriptResultToken: transcript.resultToken, mediaVersion: transcript.mediaVersion })
        .sort({ createdAt: -1, _id: -1 }).session(session);
      result = { courseVersion: course.__v, ...(job ? publicSuggestion(job) : { status: 'queued' }) };
    }, { readConcern: { level: 'snapshot' } });
    return res.json(result);
  } catch (error) { return sendError(res, error); }
});

function review(action) {
  return async (req, res) => {
    try {
      const body = req.body;
      const allowed = action === 'edit' ? ['topics', 'reviewRevision'] : ['reviewRevision'];
      if (!body || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key)) ||
          !Number.isSafeInteger(body.reviewRevision) || body.reviewRevision < 0) fail(400, 'Provide a valid reviewRevision and supported fields only');
      if (!mongoose.isObjectIdOrHexString(req.params.suggestionId)) fail(400, 'Invalid suggestion');
      let result;
      await mongoose.connection.transaction(async session => {
        const { course, lesson, transcript } = await target(req, session);
        assertCourseVersion(req, course);
        if (!transcript) fail(409, 'Transcript or media changed; reload suggestions');
        const job = await Suggestion.findOne({ _id: req.params.suggestionId, course: course._id,
          lessonId: lesson._id, transcriptionJobId: transcript._id, transcriptResultToken: transcript.resultToken,
          mediaVersion: transcript.mediaVersion, status: 'completed' }).session(session);
        if (!job) fail(409, 'Suggestions are stale or unavailable');
        if (job.reviewStatus !== 'pending' || job.reviewRevision !== body.reviewRevision) fail(409, 'Suggestions were already reviewed or edited; reload');
        // Serialize review with transcript regeneration/publication in the same transaction.
        await Transcription.updateOne({ _id: transcript._id }, { $inc: { __v: 1 } }, { session });
        const duration = statedDurationSeconds(lesson.duration) || null;
        if (action === 'edit') {
          if (!Array.isArray(body.topics)) fail(400, 'Provide topics');
          const validated = topicFields({ topics: body.topics }, [], duration);
          if (validated.error) fail(400, validated.error);
          job.draftTopics = validated.values.topics;
        } else if (action === 'accept') {
          if (!job.draftTopics.length) fail(400, 'There are no topics to accept');
          // Existing topics are immutable through this endpoint. Tutors can trim the
          // suggestion draft into available gaps; conflicts never replace old IDs.
          const additions = job.draftTopics.map(t => ({ title: t.title, startTimeSeconds: t.startTimeSeconds, endTimeSeconds: t.endTimeSeconds }));
          const existing = lesson.topics.map(t => ({ _id: t._id, title: t.title, startTimeSeconds: t.startTimeSeconds, endTimeSeconds: t.endTimeSeconds }));
          const merged = [...existing, ...additions].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
          const validated = topicFields({ topics: merged }, lesson.topics, duration);
          if (validated.error) fail(409, `Existing topics are preserved. Edit suggestions to fit unoccupied ranges: ${validated.error}`);
          lesson.topics = validated.values.topics;
          const existingIds = new Set(existing.map(t => String(t._id)));
          job.acceptedTopicIds = lesson.topics.filter(t => !existingIds.has(String(t._id))).map(t => t._id);
          job.reviewStatus = 'accepted';
          if (course.moderationStatus !== 'rejected') course.moderationStatus = 'unpublished';
        } else {
          job.reviewStatus = 'rejected';
        }
        job.reviewRevision += 1;
        job.reviewedBy = req.user._id;
        job.reviewedAt = new Date();
        // A write on Course fences concurrent media replacement even for edit/reject.
        if (action === 'accept') {
          await course.save({ session });
        } else {
          // increment() + save() is a no-op for an otherwise unmodified document.
          await Course.updateOne({ _id: course._id, __v: course.__v }, { $inc: { __v: 1 } }, { session });
          course.__v += 1;
        }
        await job.save({ session });
        result = { courseVersion: course.__v, ...publicSuggestion(job) };
      });
      return res.json(result);
    } catch (error) { return sendError(res, error); }
  };
}
router.patch(`${route}/:suggestionId`, review('edit'));
router.post(`${route}/:suggestionId/accept`, review('accept'));
router.post(`${route}/:suggestionId/reject`, review('reject'));
module.exports = router;

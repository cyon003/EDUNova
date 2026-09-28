# Milestone 2 local integration test

Run from the repository root:

```sh
cd frontend
npm run test:e2e:milestone2
```

Prerequisites: `mongod` on PATH; Google Chrome installed; macOS `sandbox-exec`;
provisioned `transcription-worker/.venv` and `.venv-topics` environments and local
Whisper-small/MiniLM model directories documented in `transcription-worker/README.md`.
The fixture is the existing read-only 636.523-second algorithms lecture named in
`milestone2.mjs`. The test does not provision/download model weights.

The runner creates its own temporary MongoDB replica set on a kernel-assigned port
and an isolated upload directory. It seeds a synthetic tutor, five students, a
lesson with a manual topic and quiz, coverage records, and ten historical confusion
events. It imports the real Express `app.js`, starts Vite on localhost:5179, and
uses headless Google Chrome through Playwright. Port 5179 must be free. It never
loads backend `.env`, uses application MongoDB credentials, or starts `server.js`.
All tested browser HTTP requests go to the real local frontend/backend; there are
no mocked transcription, generation, review, or analytics responses. Browser
external requests are blocked. Both Python worker entry points run continuously
with OS-blocked outbound networking (localhost MongoDB allowed).

The browser logs in, opens the saved lesson, uploads a copy of the lecture, observes
normal polling, edits the overlapping generated range, previews video/transcript,
and accepts the suggestions. The fixture is then published directly in the scratch
database solely to test the enrolled student player; admin moderation is not part
of this test. Student topic navigation uses the existing seek restriction, so a
new learner cannot skip unseen video. Tutor analytics is checked through both the
real API and rendered dashboard.

Assertions cover 107 persisted Whisper segments, five generated topics, preservation
of manual IDs/ranges/text and quiz structure, byte-identical source/upload hashes,
ten unchanged historical confusion records, the original topic's 100% confusion
rate (five of five exposed students), zero historical confusion assigned to newly
accepted topics, unauthorized review requests, and duplicate acceptance rejection.
This validates analytics over seeded historical predictions; it does not invoke or
validate the Random Forest model. Gemini is not used.

Artifacts are written to `.cache/milestone2-e2e/`: `result.json`, tutor/student and
analytics screenshots, and failure screenshots/text when applicable. Processes
are stopped and the scratch database/uploads are deleted after each completed run.
The runner is opt-in and is not part of `npm test`.

## Reproduced integration defects

1. Accepted topics were persisted and returned to students, but `LessonPlayer` had
   no topic rendering. `LessonTopics.jsx` now renders saved ranges with stable IDs
   and seeks through the existing media element/handlers. It never changes watch
   coverage, completion, or model logic. Two DOM regressions cover display, seeking,
   empty lists, and unavailable media; the browser assertion failed before this fix.
2. After review, the lesson editor refreshed but the dashboard retained old course
   and analytics data. `reloadLessons` now updates the course cache and refreshes
   analytics. The browser assertion for the accepted topic in analytics reproduced
   this defect before the fix. No analytics calculation or historical event changed.

Earlier harness-only failures were corrected: waiting for MongoDB readiness before
connecting; explicit navigation from the login landing page to the tutor dashboard;
and checking actual seek position instead of a temporary status message.

## Observed results — 2026-09-27

- **Automated real-browser end to end: PASS**, exit code 0. Real Chrome + Vite +
  Express + disposable MongoDB replica set + both real local workers. Whisper
  persisted **107 segments**; MiniLM generated **5 suggestions**; acceptance left
  **6 saved topics**, including the unchanged manual topic. Tutor and student
  browser assertions, exact transcript excerpt, video seeking, analytics cache
  refresh, authorization, duplicate-write rejection, and final preservation checks
  all passed. No uncaught browser page errors were recorded.
- **API integration regression: PASS**, 5 Node tests and 11 Python tests, using its
  own disposable replica set. This additionally covers concurrent review, retries,
  stale sources, publication races, and manual/historical preservation.
- **Frontend automated regression: 180 passed**, 0 failed/skipped, including the two
  new student-topic DOM tests. **Backend regression: 156 passed**, 8 opt-in tests
  skipped (the topic opt-in suite was run separately as above).
- **Production frontend build: PASS**, 157 modules. Main JS bundle is 672.40 kB
  (189.89 kB gzip), retaining Vite's >500 kB warning. New component ESLint, runner
  syntax validation, and `git diff --check` passed.
- **Manual browser checks:** no separate manually operated browser session. The
  tutor-review, student-topics, and analytics screenshots produced by automated
  Chrome were visually inspected. Do not count screenshot inspection as another
  end-to-end run or as accessibility/mobile coverage.

The unchanged source and uploaded-copy SHA-256 is
`017fe8d7a432139d2c531792f2989838accfc26c9af9acefb5510b64f9bb25e3`.
The final JSON reports `passed: true` and `browserErrors: []`. Temporary database,
upload copies, and processes were cleaned up. No deployment or application data
mutation occurred outside the test's scratch resources.

Remaining observations: navigating immediately away from the login landing page
logs a home-course fetch cancellation as `Failed to fetch` in the dev console;
Mongoose logs deprecated `new` option warnings; terminating the Python workers
logs a semaphore resource-tracker warning. None caused a failed final assertion.
The test covers desktop Chrome/macOS and this one English lecture, not mobile,
other browsers, long-running worker operation, admin moderation, fresh RF inference,
or Gemini. Historical events are seeded test records rather than production data.
Existing generation quality and batch-review limitations remain documented in
`../TOPIC_SUGGESTIONS.md` and `../../transcription-worker/README.md`.

## Existing saved videos: explicit generation

Older lessons can have a playable main video without `transcriptionSource.mediaVersion`.
Upload/replacement handlers create this durable intent, but neither ordinary saves
nor the worker's reconciliation backfill older lessons. The transcription GET
therefore returned `not_requested` (previously displayed as “Unavailable”) while
suggestions returned `awaiting_transcript`. This does not by itself indicate a
model failure.

The tutor editor now displays “Not requested” and a **Generate transcript and topics** button. It calls authenticated owner-only
`POST /api/tutor/courses/:courseId/lessons/:lessonId/transcription` with
`X-Course-Version`. The server resolves the same main media as playback, checks
that the local original is readable, and records a source/version with optimistic
concurrency. Legacy video/resource metadata is promoted without moving or
rewriting the file. The unique existing durable job is reused; queued, processing,
completed and failed jobs are not reset. Manual transcript/topics, quiz, progress,
publication status and historical analytics are untouched. Suggestions remain a
separate review step. Missing files/unsupported media return 422, stale versions
409, missing version 428, unauthorized users 401/403, and non-owners 404.

This is not a retry/regeneration endpoint. Existing failed jobs still require
administrator investigation; the worker performs its existing bounded retries.
External URLs and audio cannot be submitted. No automatic model download or
worker startup is added. Both worker processes must run with matching `MONGO_URI`
and `MONGO_DB_NAME`; Whisper's `UPLOAD_ROOT` must point to the backend's shared
files. `TRANSCRIPTION_MODEL_PATH`/`TRANSCRIPTION_MODEL_REVISION` and
`TOPIC_MODEL_PATH`/`TOPIC_MODEL_REVISION` must reference separately provisioned local
weights. See [worker setup](../../transcription-worker/README.md). “Queued” is
persisted job state, not a worker health check.

Run the disposable legacy-video variant (same real models/browser as above):

```sh
cd frontend
E2E_EXISTING_VIDEO=true npm run test:e2e:milestone2
```

It copies the original lecture to scratch storage, seeds an older lesson with a
legacy video URL and no source intent, clicks the generation button instead of
uploading, and checks preservation of manual content, enrollment progress,
watched ranges and historical confusion before reviewing/accepting suggestions.
Artifacts are written to `.cache/existing-video-e2e/`. No existing database is
read or changed.

Files changed for this workflow:

- `backend/routes/transcriptionRoutes.js`: owner-only generation request, version/file checks, and storage-aware status fencing.
- `backend/utils/primaryMedia.js` and `backend/routes/courseRoutes.js`: share the existing playback media resolver without changing its selection rules.
- `backend/tests/transcription.test.js`: concurrent request, owner/student access, completed-job reuse, missing/removed media, stale version, preservation and legacy resolution regressions.
- `frontend/src/components/TopicSuggestions.jsx`, `LessonManager.jsx`, and `frontend/src/utils/topicSuggestions.js`: explicit generation action, status wording, success and persistent error feedback.
- `frontend/tests/topicSuggestions.test.jsx`: generation, unsaved changes, authorization, stale version and missing-file UI regressions.
- `frontend/e2e/milestone2.mjs`: opt-in older-video fixture and progress-preservation checks.

Verified results for the existing-video workflow (2026-09-27):

- Real headless Chrome + backend/frontend + disposable MongoDB replica set + OS-offline Whisper/MiniLM: passed, exit 0; 107 segments, 5 suggestions, no uncaught browser errors. Review, acceptance, student topic display and analytics also passed. This was browser automation, not a manual browser session.
- Frontend regressions: 182 passed, 0 failed.
- Backend regressions: 157 passed, 8 opt-in tests skipped, 0 failed.
- Opt-in transcription API integration: 2 Node tests passed; Python discovery ran 19 tests with 13 passed and 6 unrelated topic integration tests skipped. The subsequently added media-resolution unit test also passed.
- Production frontend build: passed, 157 modules; existing >500 kB chunk warning remains (main JS 673.41 kB).
- Existing-video evidence: `.cache/existing-video-e2e/result.json` (`passed: true`), plus tutor/student/analytics screenshots.

Coverage remains a single English lecture on desktop Chrome/macOS. No live
production/staging configuration was accessed. Missing worker processes cannot
be detected by the current status API; it reports durable jobs, not worker
heartbeats. No failed-job reset or model provisioning is performed by the button.

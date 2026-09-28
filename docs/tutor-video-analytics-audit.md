# Tutor video analytics audit — 2026-09-28

> Historical implementation report. The Lecture Explorer was replaced by [Learning Insights](learning-insights-report.md). Its component, stylesheet, dedicated tests and browser script have been removed; file paths and commands below describe the earlier implementation, not the current workflow.

Repository audit completed before dashboard implementation. No live database or environment secrets were read.

| Stored metric | Exact meaning / supported use |
|---|---|
| LearningSignal.aiPrediction | Latest RF prediction per student/course/lesson, from cumulative lesson features. Lesson rate is rounded confused-label count / valid latest predictions. Not an average probability. |
| ConfusionEvent | Only confused RF results are recorded by the current writer. Has createdAt, videoTimestampSeconds, immutable mapped topicId/title (or null), cumulative signalsSnapshot, model version and probability. Two-minute cooldown per student/topic (30-second position bin if unmapped). Not a complete prediction or behavior event stream. |
| LessonVideoExposure.watchedRanges | Merged unique media intervals per student/lesson. Topic qualifies at >=50% intersection with its duration. Rewatching doesn't add unique coverage twice. |
| Topic confusion rate | Distinct sufficiently exposed students with at least one mapped confused event / all distinct sufficiently exposed students. Rounded percent, hidden below five exposed students. Exposure can qualify without a current prediction: absence of an event is NOT evidence of clarity. |
| pauseCount | Cumulative lesson counter for intentional pauses (playing, not ended, user media intent within 1.5 seconds). No individual event time, position, topic or duration. |
| replayCount | Cumulative lesson counter for a backward seek of >=10 seconds. Not total rewatch time or topic replay count. |
| activeTimeSeconds | Cumulative visible, playing media seconds from the client timer, in integer batches. Not total elapsed lesson time or unique video coverage. |
| visitCount | Cumulative lesson visits (client suppresses immediate StrictMode duplicates). Not unique students. |
| maximumVideoProgressPercent | Furthest media position as percentage, NOT unique coverage. |
| Self-report | Latest clear/confused feedback and update time. Separate from RF; not used as model truth. |
| Enrollment analytics | Existing enrollment count, average stored progress, completed enrollments / enrollments. Course RF rate pools student-lesson predictions, not unique course students. |

LearningSignal contains aggregate updatedAt/lastInteractionAt, not individual pause/replay records or topic IDs. Its aiPrediction is replaced; ConfusionEvent preserves confused-only historical context. Current topic cohorts are based on exposure, independent of latest lesson predictions. Null-topic and deleted-topic events remain separately counted among students with valid lesson predictions; neither is remapped. Different topics can have different denominators.

Accurate section pause/replay counts, pause duration, continuous confusion probability and longitudinal confusion rates are unsupported. Differences between cumulative snapshots cannot establish where behavior occurred. The truthful alternative is a discrete topic timeline plus lesson-wide totals for the explicitly named prediction cohort. Potential future instrumentation: batched bounded event records containing event type, media version, position and monotonic duration (for completed pause intervals), authenticated student/lesson identity, idempotent event IDs and a retention policy. No raw clickstream or new instrumentation is added here.

Reuse: GET /api/tutor/analytics, topicAnalyticsService, sufficientlyExposed, authenticated /api/courses/:slug/lessons/:index/media-access, sessionFetch, TutorDashboard, existing thresholds (<40 low, 40–69 medium, >=70 high). Accepted and manual topics share the lesson topic schema; pending suggestions stay separate. Stable IDs and historical mappings are retained; the dashboard calls these saved topics without claiming every topic was AI generated.

Query scope: existing analytics already loads tutor-owned courses, valid prediction documents and watched ranges and groups events in MongoDB. This work must add no per-topic queries or raw event history fetches. Existing all-course aggregation remains a scaling limitation; large installations need a separately paginated lesson analytics endpoint, not silent result truncation. Historical exposure/events have no media-version field, so the dashboard cannot isolate behavior by replacement-video version; existing attribution is retained rather than reinterpreted.

## Implementation and API additions

The lecture explorer is inserted above the existing heatmaps and enrollment chart. No AI service, event writer, model, database schema or topic calculation was changed. Preview uses the existing signed media-access endpoint with the course version; it does not mount student tracking hooks or post learning signals. Topic navigation remains read-only.

GET `/api/tutor/analytics` now additionally returns `courseSlug`, `courseVersion`, and `lessonCatalog` (including empty lessons). Lesson rows include `durationSeconds` and `behavior: {cohortStudents, metrics}`. Each metric contains `total` (null below five recorded students) and `studentCount`; missing counters aren't assumed to be zero. These totals cover the valid latest-prediction cohort, not every enrolled student and not the selected topic's cohort. No student IDs are returned. Defensive deduplication selects the latest valid prediction per student/course/lesson before aggregating; the live schema already enforces this uniqueness. Existing filtered `lessons` and old response fields remain available to the legacy heatmap.

| Modified/added file | Purpose |
|---|---|
| `backend/services/analyticsBehaviorService.js` | Defensive student deduplication and thresholded whole-lesson counter totals |
| `backend/routes/tutorRoutes.js` | Add aggregate/catalog fields using existing query results |
| `backend/tests/analyticsBehavior.test.js` | Cohort, coverage, missing-counter/prediction, duplicate and historical mapping regressions |
| `backend/tests/tutorHeatmap.test.js` | API catalog/privacy regression and duplicate-student expectation |
| `frontend/src/components/TutorVideoAnalytics.jsx` | Course/lesson navigation, authorized video, topic map, behavior and insights |
| `frontend/src/styles/TutorVideoAnalytics.css` | Responsive desktop/mobile presentation |
| `frontend/src/utils/tutorVideoAnalytics.js` | Sample gating, consistent bands and deterministic insights |
| `frontend/src/pages/TutorDashboard.jsx` | Integrate explorer; retain existing features and clarify old model-flag wording |
| `frontend/tests/tutorVideoAnalytics.test.jsx` | Preview/seek, thresholds, navigation, errors, auth headers and empty states |
| `frontend/tests/tutorHeatmap.test.js` | Preserve legacy renderer tests with the new component dependency |
| `frontend/e2e/analytics-layout.mjs` | Isolated Chrome desktop/mobile layout and real-video seek checks |
| `docs/tutor-video-analytics-audit.md` | Audit, definitions, results and local instructions |

## Local Algorithm course check

1. Use your existing **local** MongoDB replica set and backend configuration. Do not replace `.env` or point this check at production/staging. Start the backend with `cd backend && npm start`; start the frontend in another terminal with `cd frontend && npm run dev`.
2. Sign in as the Algorithm course's owning tutor. Open Tutor Dashboard → Analytics → Refresh insights. In Lecture Explorer select Algorithm and the relevant saved lesson.
3. Check each topic's qualifying audience and rate. If your reported records are unchanged, Topic 1 should show 80% (4/5) and Topic 2 100% (5/5), with lesson rate 100%. These are expectations from your report, not a claim that this development run queried your database.
4. Select a saved-topic row or timeline block; verify the video seeks to its start. The selected card shows its exposed cohort. Lesson behavior totals are separate; `Unavailable` means fewer than five recorded values or absent data, never an invented zero.
5. Check gray collecting-data topics, lesson selection without topics, and the preserved legacy heatmaps/enrollment chart below. Resize to mobile width. Topic editing stays in Manage lessons.
6. If media access reports a course-version conflict, Refresh insights. A missing local video requires restoring the original upload; the dashboard does not replace it. Workers and the RF service are not required simply to read existing analytics, though their normal processes remain necessary to produce new records.

These checks are read-only with respect to analytics. Do not create fake learners or synthetic events to force a threshold in your real course. Tests below use isolated fixtures only.

## Validation

- Frontend regression suite: 188 passed, 0 failed.
- Backend regression suite: 160 passed, 8 opt-in tests skipped, 0 failed. This includes real local HTTP routing with mocked repositories; no live Algorithm database was queried.
- Frontend lint (`npm run lint`): passed.
- Frontend production build (`npm run build`): passed; existing >500 kB main-chunk warning remains.
- Browser presentation check (`cd frontend && node e2e/analytics-layout.mjs`): real headless Chrome, isolated UI fixtures and a read-only local lecture; passed at 1440px (two columns) and 390px (one column), no horizontal overflow, topic seek to 210 seconds, no uncaught page errors. This uses a mocked media-access response, not a full backend/browser integration test. Screenshots are in `.cache/analytics-layout/`; visually inspected. No manual logged-in browser session was performed.

Remaining limitations: missing section-specific behavior instrumentation and complete prediction history; no media-version attribution for historical analytics; existing all-course aggregate queries will need pagination at larger scale; UI aggregates are refreshed on demand, not live streaming. A rate with zero mapped events cannot distinguish model clarity from missing predictions. No deployment or production/staging writes were performed.

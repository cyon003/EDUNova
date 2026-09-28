# Learning Insights report

The main Analytics view now leads with Course → Lesson → topic rows. Eligible topics are sorted by descending confusion rate, with chronological ties. Low-rate topics remain visible; insufficient samples follow with “Collecting learning data.” Existing backend values and eligibility flags are used without recomputing rates. The five-student and 50%-unique-topic-coverage rules are unchanged.

Each eligible row shows title, timestamp range, percent, low/medium/high label and qualifying count. Thresholds remain 0–39%, 40–69%, and 70–100%. The copy describes potential confusion, not confirmed understanding. Algorithm values are never hardcoded into the app: if the existing data still reports 100% for “Power n — Bigger change in the value” and 80% for “N value — Square power”, they appear in that order.

The large explorer and whole-lesson behavior panels are no longer mounted on the Analytics page. Existing course heatmaps remain in a collapsed “Course heatmaps” disclosure, and enrollment/progress summaries and the enrollment chart remain available below the report. The obsolete explorer component, stylesheet, dedicated tests and browser script have been removed. Shared sample-gating and authorized-course metadata helpers now live in `frontend/src/utils/learningInsights.js`. Topic review/editing in Manage lessons is unchanged.

“View lesson” opens an inline preview on demand using the existing authenticated media-access endpoint, course version and stable-ID metadata fallback. It seeks when metadata loads, rejects invalid ranges, supports refreshed access after stream errors, and closes/aborts requests on navigation. It does not mount student tracking or write analytics records.

## Files changed in this redesign

- `frontend/src/components/LearningInsights.jsx`: compact report, sorting and optional authorized topic preview.
- `frontend/src/styles/LearningInsights.css`: scoped original dark-purple surfaces, semantic rate colors, focus/hover and responsive layout.
- `frontend/src/pages/TutorDashboard.jsx`: Learning Insights heading/integration, remove main technical summary, retain legacy heatmaps under disclosure and enrollment analytics.
- `frontend/tests/learningInsights.test.jsx`: sorting, preservation, threshold suppression, all-topic access, navigation, empty states, authorized seeking, errors and access renewal.
- `frontend/tests/tutorHeatmap.test.js`: extracted renderer dependency updated; legacy heatmap regression coverage retained.
- `frontend/tests/learningSignalTracking.test.js`: source assertion checks the retained five-prediction heatmap guard rather than a removed summary-card expression.
- `frontend/e2e/learning-insights-layout.mjs`: isolated desktop/mobile presentation and real-video seek checks.
- `docs/learning-insights-report.md`: change and verification record.

## Local check

Use the existing local backend/frontend, sign in as the owning tutor, then open Analytics. Select Algorithm and Lesson 1 — Compare Class of Functions. Check the two saved topic rates, order, timestamps and View lesson seek. Expand Course heatmaps if needed; use Manage lessons for topic edits. No new worker, endpoint or migration is required.

## Verification

- Frontend tests: 199 passed, zero failures.
- Backend tests: 162 passed, 8 opt-in tests skipped, zero failures.
- Frontend lint and production build: passed. Existing >500 kB bundle warning remains.
- Automated Chrome at 1440px and 390px: descending rate order, no horizontal overflow, no initial video, on-demand metadata/seek to 210 seconds and close all passed. Screenshots visually inspected at `.cache/learning-insights-layout/`.

Browser checks used isolated UI fixtures and a read-only local lecture, with the media-access response mocked. They do not claim to inspect or change live Algorithm records. No backend code, calculations, database records, AI pipelines, topic mappings, authorization rules or uploaded videos were modified. No deployment.

## Post-redesign cleanup

Removed the unused `TutorVideoAnalytics.jsx`, `TutorVideoAnalytics.css`, `tutorVideoAnalytics.test.jsx`, and `e2e/analytics-layout.mjs`. Replaced `utils/tutorVideoAnalytics.js` with `utils/learningInsights.js`, keeping only the sample/band and course-identity helpers used by the current report. Retired timeline/insight helpers were removed. Shared threshold boundary tests remain in `learningInsights.test.jsx`; historical reports are explicitly labeled as historical.

Cleanup verification: **189 frontend tests passed**, lint passed, production build passed (same existing bundle warning). The lower test count reflects removal of 11 retired explorer tests and addition of one shared-helper regression. No backend behavior, videos, models, configuration or saved records changed.

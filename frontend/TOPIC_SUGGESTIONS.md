# Tutor topic suggestion review

The lesson manager shows transcription and topic-generation status for the selected
saved lesson. It checks the existing tutor endpoints immediately and every 10 seconds,
without overlapping polls. Requests and timers are cancelled on unmount; polling
pauses during lesson writes and while the new-lesson dialog is open.

Tutors can inspect original generated topics, edit the suggestion draft, remove
unwanted ranges, and save edits before accepting or rejecting the batch. The panel
uses the existing MM:SS input and topic validation, including title/count limits,
ordered non-overlapping ranges, and saved media duration. It warns about overlap
with manual topics and prevents acceptance until conflicts are resolved.

Preview seeks the existing protected lesson video without auto-playing it. Transcript
excerpts show up to three overlapping segments, loading later pages when necessary.
Excerpts remain available when the saved video cannot be previewed.

Lesson edits must be saved or cancelled before review actions. Successful review
reloads the saved course so subsequent lesson saves use the new version and topic
IDs. Navigation, reload, and lesson saves ask before discarding suggestion edits.
Version/source conflicts preserve local edits and require explicit reload. A failed
reload after a successful mutation is reported separately to avoid repeating a write.

## Backend limits

- Accept/reject applies to the complete batch. Remove unwanted draft ranges before
  saving and accepting; there is no per-topic acceptance endpoint.
- Existing manual ranges are never replaced. Conflicting suggestions must be edited
  into gaps or rejected. Acceptance uses the backend's existing moderation behavior:
  it unpublishes a course unless the course is already rejected.
- There is no generation-retry API. Refresh only rereads status; exhausted worker
  failures require administrator intervention.
- `awaiting_transcript` does not distinguish missing media from a pending/failed
  transcript. Both endpoint statuses are displayed to provide that context.
- Transcript pages do not expose a result token shared with suggestions. The UI
  checks media version, completion time, model revision, and segment count across
  pages and rejects changed pagination. This is a best-effort preview consistency
  check; review writes remain protected by backend source and version validation.
- The panel does not estimate completion time or generation progress percentages
  because the APIs do not provide them.

No backend contract, uploaded video, production data, AI service, or deployment was
changed for this UI work.

## Validation

`npm test`: **178 passed, 0 failed, 0 skipped**, including 15 new rendered UI/helper
tests. Coverage includes actual status values, empty output, title/range editing,
overlap, preview and transcript paging, batch acceptance/rejection, authorization,
409/428 conflicts, stale sources, polling cleanup, unsaved-draft navigation, and
acceptance followed by a lesson save preserving manual IDs and the new version.

`npm run build`: passed (156 modules). Vite reports the main JavaScript chunk at
671.56 kB, 189.71 kB gzip, above its 500 kB warning threshold.

Targeted ESLint on all changed application JS/JSX files and `git diff --check` passed.
Tests use synthetic fixtures and mocked HTTP responses in jsdom; no live tutor
account or production/staging database was accessed. At initial UI delivery, real-browser visual inspection
and a live backend end-to-end run had not been performed. The subsequent real
frontend/backend/model integration results and fixes are documented in
[e2e/README.md](e2e/README.md). The test-only stylesheet
loader emits a Node deprecation warning for `module.register()` on newer Node.

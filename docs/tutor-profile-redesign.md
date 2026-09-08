# Tutor profile redesign

The tutor profile now has a compact identity header, real teaching totals, a responsive content layout, and a grouped inline editor. Existing profile values and course data are retained.

## Files changed for this task

- `frontend/src/components/TutorProfile.jsx` — new profile view, initials avatar fallback, completion checklist, and inline editor.
- `frontend/src/styles/TutorProfile.css` — scoped dark-theme profile styling, centered square avatar crop, keyboard focus states, and tablet/mobile layouts.
- `frontend/src/utils/tutorProfile.js` — field limits, phone/image validation, editable draft, initials, completion/summary calculation, and allowlisted multipart payload.
- `frontend/src/pages/TutorDashboard.jsx` — integrates the profile component and real course/overview data; applies canonical save responses locally. Dashboard API and notification requests use the existing managed authenticated client instead of reading legacy token storage.
- `frontend/src/styles/TutorDashboard.css` — removes confirmed-unused profile, photo-picker, and upload-dialog styles while retaining shared password/settings controls.
- `backend/routes/tutorRoutes.js` — includes existing role/accountStatus fields in profile responses and validates editable profile fields.
- `frontend/tests/tutorProfile.test.js` — rendering, state transitions, validation, fallback, preview, cancellation, duplicate-save prevention, retry, local updates, and responsive structure checks.
- `backend/tests/tutorProfile.test.js` — authenticated ownership, safe response projection, editable-field allowlist, validation, and failure/retry checks.
- `docs/tutor-profile-redesign.md` — this handoff.

No files were deleted. The old in-page Profile component and its unreachable password-settings branch were removed; the active Settings component remains. Obsolete profile CSS selectors were checked against source references before removal. Other pre-existing workspace changes were retained. No commits or pushes were made.

## Data used

Editable: name, tutorProfile.phoneNumber, expertise, education, teachingExperience, bio, and uploaded photoUrl via the existing photo upload.

Read-only: email, role, accountStatus. Courses created/published come from the tutor's existing courses response. Students enrolled uses the distinct-student count from the existing dashboard overview.

Completeness counts eight populated details: name, email, photo, phone, expertise, education, teaching experience, and biography. It is a local display calculation, not a new database field or verification score.

Teaching experience is stored as free text. It is displayed verbatim; no numeric years statistic is inferred. Unavailable summary statistics are omitted. Real zero counts remain visible.

## API and validation

`GET /api/tutor/profile` and successful `PATCH /api/tutor/profile` include existing `role` and `accountStatus` alongside name, email, and tutorProfile. Both remain behind the existing tutor authentication middleware, with identity taken from `req.user._id`. Passwords and administrative fields are excluded from the response projection.

The PATCH route still accepts the same profile fields and multipart photo upload. Optional fields can be cleared. Name is required when supplied. New text limits: name 120, phone 30, expertise 500, education 2,000, teaching experience 2,000, biography 3,000 characters. Phone accepts 7–15 digits with an optional leading plus, spaces, parentheses, periods, or dashes. Invalid edits return HTTP 400. Existing stored values are not migrated or truncated.

The existing JPEG/PNG/WebP and 5 MB upload restrictions, randomized filenames, and storage path are unchanged. A photo selected in the editor is previewed with a temporary URL, released when replaced or on exit. It is uploaded only on save.

## Validation results

- Backend: 54 tests passed.
- Frontend: 48 tests passed.
- Frontend lint: passed.
- Production build: passed; Vite reports its existing large-bundle warning (JavaScript chunk over 500 kB).
- Backend syntax checks: passed.
- Git whitespace/diff check: passed.

Frontend verification includes server-rendered React output and state/event tests. It does not replace browser visual testing. Browser verification could not run because the available browser tool failed to initialize.

## Manual verification

1. Run the backend and frontend, sign in as a tutor, and open **Profile**. Confirm the name, email, role/status, course totals, and enrolled-student total match the saved account.
2. Check a complete and a sparsely populated profile. Confirm missing fields have useful edit prompts and the completion count reflects saved details.
3. Open **Edit profile** and confirm all values are prefilled. Use the small photo action and checklist actions to confirm focus moves to the relevant editor field.
4. Choose a portrait and a wide image. Confirm the square preview crops centrally without distortion; verify a missing/broken saved image displays initials. Cancel and confirm the saved profile is unchanged.
5. Enter an invalid phone number or blank name. Confirm a field error appears and save is prevented. Save valid changes and confirm the updated profile and success message appear without a page reload.
6. Simulate a failed PATCH request. Confirm the editor retains the draft, displays the error, and permits retry. During a delayed save, confirm duplicate submits and Cancel are disabled.
7. Check desktop, tablet, and narrow mobile widths. Confirm biography, contact information, checklist, and save/cancel remain readable and keyboard-accessible, with the sidebar and notification/message controls intact.
8. Confirm unauthenticated and non-tutor requests to GET/PATCH `/api/tutor/profile` are rejected.

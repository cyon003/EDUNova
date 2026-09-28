# Optional AI quiz drafts

Endpoint: `POST /api/tutor/courses/:courseId/lessons/:lessonId/generate-quiz`, body `{ "questionCount": 5 }` (integer 2–20 only). Existing authentication, tutor role and `ownedCourse` middleware protect it. It reads the saved lesson by ID and calls a separate service; it performs no course save, update, publication or attachment deletion.

The tutor opens an existing saved lesson, chooses 2–20 questions in its existing QuizEditor, and clicks Generate with AI. Saved lesson content is sent to Gemini. Replacing existing questions requires confirmation. Generated questions populate that same editable editor with unique editor keys and null media. The tutor reviews/edits them, then uses the existing lesson Save to persist. New lessons or lessons with unsaved content changes must be saved first. Quiz-only edits can be replaced after confirmation; any quiz or lesson changes made during generation cause its result to be discarded. Leaving the editor aborts the client request.

The service uses the installed `@google/genai` SDK's `responseJsonSchema`, existing `GEMINI_API_KEY` / `GEMINI_MODEL`, and bounded `GEMINI_TIMEOUT_SECONDS` (default 60; 1–300). It does not call or modify `generateAnswer`, General AI Tutor or Lesson AI Tutor. Input is the saved title, description, summary, manual lesson transcript and accepted/manual topics; it does not fetch external references, videos or the separate versioned Whisper transcript segments. Description is capped at 5,000 characters, summary 5,000, transcript 50,000, and at most 200 topic titles. Useful material beyond the title is required.

System instructions treat lesson data as untrusted reference text, require grounding and exactly the requested count, and forbid following embedded commands. Every result is independently checked: title <=200, question <=1000, choice <=500; nonempty trimmed text; exactly four choices; normalized duplicate choices rejected; multiple_choice only; integer answer index 0–3; exact count; no media attachment. Validated output is additionally checked through existing `quizFields`. Original schema/save validation remains unchanged. No keys, full prompts, transcript content or raw provider errors are logged or returned. Provider/quota/timeout/invalid-output errors have generic actionable messages.

Limitations: grounding and answer correctness cannot be proven by schema checks; tutor review is required. Very short material may not support the requested count and is rejected if Gemini returns an invalid/incomplete quiz. No live provider call was made during verification; all provider tests use SDK mocks. No generation-specific durable job, retry queue or automatic save is added. An in-flight provider request can finish even after the browser leaves, but it cannot persist anything. Replaced saved quiz attachments are not deleted during generation.

Files:
- Created `backend/services/quizGenerationService.js`, `backend/tests/quizGeneration.test.js`, `frontend/tests/quizGeneration.test.jsx`, this report.
- Modified `backend/routes/tutorRoutes.js`, `frontend/src/components/LessonManager.jsx`, `frontend/src/styles/LessonEditor.css`.
- Updated source-extraction harnesses in `frontend/tests/lessonMerge.test.js` and `lessonSelection.test.js` for the named QuizEditor export/new state, retaining their assertions.

Local use: restart the backend to load the new route, using the existing intended local Gemini configuration; start the frontend normally. Save useful lesson material before generating. Generating sends that saved content to Gemini and may use your configured provider quota. No migration or worker change is needed.

Verification results:
- Frontend `npm test`: 194 passed, 0 failed.
- Backend `npm test`: 168 passed, 8 opt-in skipped, 0 failed.
- Frontend `npm run lint`: passed.
- Backend `npm run check` and `node --check services/quizGenerationService.js`: passed.
- Frontend `npm run build`: passed; existing >500 kB bundle warning remains.
- `git diff --check`: passed. Final status/diff review found no added or modified `.env`, keys, model weights, uploads, node_modules, dist, or other private/generated files. No commit, push or deployment performed.

New backend tests cover tutor authorization/ownership, missing lessons, invalid count/client context, missing material, structured request configuration, no automatic persistence, malformed output and field/choice/answer validation, safe provider/quota/timeout errors. New frontend tests cover controls/count/loading, editable/deletable drafts, confirmation/cancel, errors, dirty/new lesson blocking, stale-result protection and unmount cancellation. Existing chatbot and unrelated regression tests remain intact.

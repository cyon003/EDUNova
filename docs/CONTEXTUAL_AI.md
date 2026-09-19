# Contextual Ask AI (Step 3)

General requests remain `{ mode: "general", message }`. Lesson requests add only
`mode: "lesson"`, `courseId`, `lessonId`, and numeric `videoTimestampSeconds` to the message.
Other lesson fields are rejected. General requests continue rejecting course-context fields.

The authenticated student must be enrolled in the course. The server loads the actual
lesson and maps the timestamp using `topicAtTimestamp`; missing topics and transcripts
are allowed. Timestamp validation requires a finite nonnegative number. The stored
lesson duration is a display string, not a reliable numeric media duration, so it is
not used as an authoritative upper bound. Out-of-topic timestamps have no topic.

Lesson context is rebuilt from current server-owned material on every chat request:
course/lesson/topic titles (200 characters each), description (1,000), summary (2,000),
and a transcript prefix (8,000). A truncation flag accompanies the transcript. This
plain-text prefix is **not timestamp-aligned** and must never be described as what the
tutor said at the supplied position. These fixed character budgets are not new
production environment variables. The existing overall Gemini prompt budget still applies;
optional transcript/summary/description and history are trimmed before the question or
mandatory lesson metadata, including continuation requests. An impossibly small budget
fails safely instead of sending a truncated question.
Reference text is data, not instructions. Existing safety rules and response limits remain.

History GET/DELETE accepts lesson mode with the same IDs and timestamp (query strings).
Both reauthorize enrollment and remap the topic before querying. Listing, clearing and
recent Gemini history use authenticated user + mode + course + lesson + resolved topic ID.
No-topic positions share a null-topic scope within that lesson. General history remains
user + general mode. Metadata stored per lesson turn includes position and resolved topic;
no transcript is copied into conversation records. Editing topic ranges can change which
history is selected for a position; deleting a topic makes its old scope inaccessible
through current mapping. A future history-management UI may need to handle this explicitly.

The existing history response and chat response expose only course/lesson/topic titles
and position as context metadata, never transcript excerpts. The frontend first shows
“Lesson context attached”, then authorized metadata. Opening Ask AI does not generate an
answer or spend AI quota. Only manual chat submissions do, through the existing shared
rate limiter and quota reservation/settlement path.

React Router state carries identifiers and position only. Direct navigation without it
uses general mode; if a browser retains state across refresh, the backend reauthorizes it.
No additional localStorage/sessionStorage persistence is introduced. Authentication or
context changes remount the chat interface; late responses cannot populate a new context.

Step 4 analytics should continue using ConfusionEvent, not chat messages as evidence of
confusion. Topic snapshots and current topic edits can differ. This step adds no analytics,
transcription, RF changes, or automated topic creation.

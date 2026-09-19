# Topic exposure and confusion analytics (Step 5)

## Exact metric

Topic exposure is the percentage of **unique media-time coverage** within the current
server-owned topic boundaries. `SUFFICIENT_EXPOSURE_RATIO` in
`backend/utils/videoExposure.js` centralizes the initial threshold: **>= 50%**.

For each current topic:

- `observedStudents`: distinct students with >= 50% coverage of that topic.
- `confusedStudents`: distinct students in that exposed cohort with at least one
  qualifying ConfusionEvent for the same course, lesson and stored topic ID.
- `confusionRate`: rounded `100 * confusedStudents / observedStudents`.

Qualifying events have source `random_forest`, prediction `confused`, probability in
[0,1] and nonnegative timestamp. Multiple events from one student count once per topic.
Confusion events from insufficiently exposed students do not increase the numerator.
There is no new RF classification threshold, feature or model. Ask AI usage is excluded.

At least **5 sufficiently-exposed students per topic** are needed for percentages and
low/moderate/high bands (0–39 / 40–69 / 70–100). Otherwise the API returns null rate and
`sampleSufficient: false`; the UI shows “Collecting data”. This is a display threshold,
not statistical assurance. RF output remains behavioral inference, not proof of confusion.

Example: 8 distinct exposed students with qualifying events among 10 exposed students
produces 80%, labeled “8 of 10 students who sufficiently viewed this topic showed
confusion signals.” Events are cumulative, without a reporting time window.

## Playback collection and validation

Visible VIDEO playback samples accumulate media-time intervals only when successive
samples move forward plausibly according to elapsed monotonic wall time and playback
rate. Supported rates are 0.25x–4x. Gaps over two wall-clock seconds are discarded, as
are jumps beyond elapsed seconds × playback rate + 0.25 media seconds of timing tolerance.
Seeks, rate changes, metadata loading, paused/hidden playback and page exit reset the
sample anchor. Seeking does not imply coverage. Playback after seeking starts a new
range; rewatches merge with prior ranges instead of double counting. Audio is excluded.

The browser rounds range endpoints inward to milliseconds. Backend merging also rounds inward to
millisecond precision, so rounding cannot promote a just-below-threshold range. Overlapping/adjacent ranges merge deterministically, and totals
are server-derived. The normal 25-second flush lifecycle, prediction flushes, video end,
hiding and lesson navigation submit pending ranges. Requests do not occur per video event.
Exposure failures are independent of RF tracking and playback; failed batches are retained
in memory with no retry for at least 25 seconds. Exit writes are best effort. Coverage can
be undercounted if a tab closes offline or the browser suspends samples; it is not fabricated.

`PATCH /api/learning-signals/:courseId/:lessonId/exposure` accepts only:

```json
{"watchedRanges":[{"startTimeSeconds":480.2,"endTimeSeconds":492.7}]}
```

Existing student authentication, enrollment and course/lesson membership checks apply.
Student identity is taken from authentication. Client topic IDs, totals, percentages and
sufficient-exposure booleans are rejected. Each batch permits 1–32 ranges, at most 30 media
seconds per range and 120 media seconds total. Timestamps must be finite, nonnegative,
in increasing order within each range, and at most 86,400 seconds (24 hours). The browser
also clamps to a reliable video duration. The server's existing duration is only a display
string, so it cannot enforce a trustworthy numeric video duration; the validation utility
supports a numeric bound when one becomes available. This is practical behavioral
telemetry, not DRM or proof against a malicious authenticated client forging many batches.

## Storage and concurrency

LessonVideoExposure stores one record per student/course/lesson, enforced by a unique
index. It holds merged watchedRanges, server-derived totalUniqueWatchedSeconds and update
timestamps, with a course/lesson query index. No transcripts are duplicated. A versioned
compare-and-swap retries conflicts up to five times; duplicate submissions are idempotent.
Concurrent tabs cannot overwrite successful coverage. Database failure leaves prior ranges
intact; exhaustion returns a recoverable error for a later normal batch.

Stored and browser-pending coverage is bounded to 2,048 disjoint ranges. The server rejects
updates exceeding its cap without overwriting existing ranges; the browser conservatively
retains the earliest pending ranges when full. Extremely fragmented viewing/offline sessions
can therefore be undercounted. Tutor analytics loads exposures in one course-scoped query,
plus the existing signal query and one grouped event query; there are no per-topic queries.
Large deployments may need incremental coverage summaries/pagination and retention policies.

## Legacy and topic edits

Existing lesson-level metrics and their saved-prediction denominator remain available.
Lesson-level `observedStudents`, unmappedConfusionStudents and historicalConfusionStudents
retain their prior lesson-observed semantics; they are separate from named topic rates.
The UI labels these secondary counts as lesson-observed. No exposure is reconstructed from
maximum progress, predictions or old events. Topics initially collect data until actual
exposure records arrive; a student can qualify without having a latest lesson prediction.

Topic exposure is recomputed from stored VIDEO TIME against current topic ranges. Confusion
history is different: events keep their original topic ID and are never reassigned using
edited timestamps. Current IDs determine rows and order; retained IDs retain their event
history, while deleted/null IDs remain separate aggregate buckets.

Only aggregate counts/rates and current topic metadata/latest qualifying times reach the
tutor; student identities, raw ranges/events and chat content remain private. Queries remain
restricted to current tutor-owned courses and lessons.

## Next-step concerns

Replacing a lesson video requires an explicit media-version/reset policy: stored time
coverage currently belongs to the lesson ID, not a video fingerprint. Also consider true
numeric media duration, exposure retention/deletion cleanup, background playback policy,
reporting windows and versioning topic definitions/model versions. No automatic transcription,
forward-seek blocking, RF changes or other later features are added here.

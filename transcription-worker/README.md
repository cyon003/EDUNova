# Local asynchronous transcription (Milestone 1)

This worker is separate from the Flask confusion service. It processes only local
video media selected through lesson creation, replacement, or resource promotion.
It does not modify media, manual transcripts, topics, playback, or Gemini context.
No external inference APIs are used. Existing lessons are not bulk-enqueued.

## Installation (not performed automatically)

Use Python 3.10+ in a separate environment:

```sh
python3 -m venv transcription-worker/.venv
transcription-worker/.venv/bin/python -m pip install -r transcription-worker/requirements.txt
```

Provision a complete CTranslate2-format Whisper model directory separately,
including model.bin, config.json, tokenizer.json and vocabulary files. Use trusted,
versioned open-source weights; record their revision/checksum. No model download
happens at application startup. An explicit local directory, local_files_only and
offline environment flags prevent model-hub fallback. PyAV wheels include FFmpeg
libraries; an ffmpeg executable is not required. No packages are added to the RF
service's environment.

Configure these variables in the worker's environment (it does not load .env):

```sh
export MONGO_URI='mongodb://127.0.0.1:27017/edunova'
export MONGO_DB_NAME='edunova'
export UPLOAD_ROOT='/absolute/path/to/backend/uploads'
export TRANSCRIPTION_MODEL_PATH='/absolute/path/to/provisioned/whisper-small'
export TRANSCRIPTION_MODEL_REVISION='your-verified-model-revision'
export TRANSCRIPTION_CPU_THREADS=2
export TRANSCRIPTION_MAX_DURATION_SECONDS=7200
transcription-worker/.venv/bin/python -B transcription-worker/worker.py
```

MONGO_DB_NAME must match the backend database. Start with one worker, CPU INT8,
two CPU threads, and a multilingual small model. Budget roughly 4 GB available RAM
as an initial allocation, plus model storage and MongoDB result storage; benchmark
real lectures before selecting production resources. Long audio decoding itself
consumes memory. Default maximum duration is two hours. CPU throughput depends on
hardware and language; there is no real-time guarantee. No Azure deployment is
included. Give the worker read-only filesystem access to uploads and model weights.
Use a dedicated MongoDB account able to read courses and read/write only the two
transcription collections. Never expose worker database credentials to clients.

## Durability and isolation

A transcriptionSource intent with a fresh UUID is persisted inside the lesson in
the same save as selected media. The backend best-effort upserts a job after save;
the worker reconciles persisted intents every 30 seconds, recovering the crash gap.
A unique (course, lessonId, mediaVersion) index prevents duplicates. Jobs are claimed
atomically, leased for 120 seconds, and renewed every 40 seconds. Expired jobs can
be reclaimed after restart. At most three attempts are permitted; transient errors
wait 30 seconds times the attempt number. Missing audio, malformed media, invalid
segments, silence and invalid duration are terminal errors.

Each attempt writes independent segment documents. A live lease token fences result
publication. A replacement creates a different mediaVersion; stale jobs become
superseded and the API only reads the current media version. A replacement racing
publication may leave an old job completed, but it remains historical and cannot
replace or be returned as the new video's result. Deleted lessons are not readable.
Original files are opened read-only. Partial/abandoned attempt segments and old jobs
are retained for now; add a retention policy before substantial production usage.

Inference is synchronous within the worker, with a separate lease heartbeat.
Use a process supervisor for worker crashes/hangs; restart recovery is lease-based.
Milestone 1 has no UI, bulk backfill, manual retry endpoint, topic segmentation, word-level
alignment, or transcription quality guarantee in this milestone. Silence is reported
as no_speech, not published as a completed empty transcript. This is segment-level
ASR output and requires review before use as authoritative lecture content.

## Tutor API

`GET /api/tutor/courses/:courseId/lessons/:lessonId/transcription?offset=0`

Requires an authenticated owning tutor. Returns status, mediaVersion, attempts,
errorCode, language, modelRevision, completedAt, segmentCount and up to 200 segments
with index/startTimeSeconds/endTimeSeconds/text. Follow nextOffset until null.
Statuses: not_requested, queued, processing, completed, failed, superseded.
Queued can mean the persisted intent is awaiting reconciliation. Internal filenames,
lease tokens and decoder error details are not exposed by this endpoint.

## Tests

The integration runner starts disposable MongoDB and HTTP listeners. It never uses
the application's configured database or uploaded media. mongod must be on PATH.

```sh
RUN_TRANSCRIPTION_MONGO_TESTS=true \
TRANSCRIPTION_TEST_PYTHON="$PWD/transcription-worker/.venv/bin/python" \
node --test backend/tests/transcription.test.js
```

Python integration tests use real MongoDB for unique indexes, concurrent claims,
leases, restart recovery, retries, replacement, and segment persistence. Inference
and media decoding are stubbed for deterministic failure tests, so no weights are
needed. Real-model accuracy/performance and actual decoder compatibility require a
separate smoke test with provisioned weights and representative video fixtures.

## Real inference validation on macOS (opt-in)

The real smoke test uses an existing upload read-only and starts a disposable local
MongoDB. It never reads backend credentials or connects to the application database.
It verifies ordered segments persisted by Worker.process(), preserves manual fields,
checks the video's SHA-256 before/after, and reports elapsed time and process peak RSS.
The scratch database is removed after verification. No real-model test is implied by
passing the ordinary stubbed tests.

One-time online setup from the repository root:

```sh
python3 -m venv transcription-worker/.venv
transcription-worker/.venv/bin/python -m pip install -r transcription-worker/requirements.txt
HF_HOME="$PWD/.cache/huggingface" transcription-worker/.venv/bin/python - <<'PY'
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download
repo = 'Systran/faster-whisper-small'
revision = HfApi().model_info(repo).sha
folder = Path('.cache/models/faster-whisper-small').resolve()
snapshot_download(repo_id=repo, revision=revision, local_dir=str(folder),
                  allow_patterns=['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.*', 'preprocessor_config.json'])
(folder / 'REVISION').write_text(revision + '\n')
print('Provisioned:', folder, 'revision:', revision)
PY
```

This resolves and records an immutable revision at provisioning time. Retain that
revision and the directory for reproducibility. It is an explicit model download,
not an inference API call; neither production startup nor the tests download weights.
The multilingual small model is the initial CPU INT8 candidate.

Inspect candidate durations/audio without decoding or altering originals:

```sh
transcription-worker/.venv/bin/python - <<'PY'
from pathlib import Path
import av
for path in Path('backend/uploads/course-videos').glob('*.mp4'):
    try:
        with av.open(str(path)) as media:
            seconds = media.duration / av.time_base if media.duration else None
            if seconds and seconds <= 600 and media.streams.audio:
                print(round(seconds, 2), str(path))
    except Exception as error:
        print('Unreadable:', path.name, type(error).__name__)
PY
```

Select a short lecture from that output (confirm its content), then run:

```sh
export TEST_VIDEO="$PWD/backend/uploads/course-videos/REPLACE_WITH_SELECTED_FILENAME.mp4"
export TEST_MODEL="$PWD/.cache/models/faster-whisper-small"
export TEST_REVISION="$(cat "$TEST_MODEL/REVISION")"
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
transcription-worker/.venv/bin/python -B transcription-worker/tests/real_inference.py \
  --video "$TEST_VIDEO" --model "$TEST_MODEL" --revision "$TEST_REVISION"
```

Repeat in a fresh process with macOS OS-level outbound blocking. Only localhost
network traffic is allowed, for the disposable MongoDB. This does not change the
Mac's global firewall or connectivity:

```sh
/usr/bin/sandbox-exec -p '(version 1) (allow default) (deny network-outbound) (allow network-outbound (remote ip "localhost:*"))' \
  transcription-worker/.venv/bin/python -B transcription-worker/tests/real_inference.py \
  --video "$TEST_VIDEO" --model "$TEST_MODEL" --revision "$TEST_REVISION" \
  --assert-network-blocked
```

The second command requires sandbox-exec support on the host; the test first demands
an OS permission denial on a non-loopback connection. A timeout is not accepted as
proof of isolation. Offline environment flags alone are not proof of a network block.
Peak RSS covers the Python process (including loaded model/native libraries), not
MongoDB or total system memory. Validate output against audible lecture content;
ordered timestamps alone do not establish transcription accuracy.


### Validating the provisioned local lecture/model

`requests` is explicitly included in requirements; the installed environment passes
`pip check`. For the existing 636.52284-second algorithms lecture, the smoke test's
600-second default can be overridden explicitly without changing worker limits:

```sh
transcription-worker/.venv/bin/python -B transcription-worker/tests/real_inference.py \
  --video backend/uploads/course-videos/e6af9f76-508d-4890-8a8b-87fb71981a9e.mp4 \
  --model transcription-worker/models/faster-whisper-small \
  --revision 536b0662742c02347bc0e980a01041f333bce120 \
  --max-video-seconds 660
```

For OS-enforced offline verification, prefix that command with the `sandbox-exec`
profile above and append `--assert-network-blocked`. No application MongoDB URI or
credentials are needed: each invocation starts and shuts down its own temporary
MongoDB process and removes only that process's temporary data directory.

### Observed real integration results

Validated the existing 636.52284-second English algorithms lecture using local
Systran/faster-whisper-small, revision
`536b0662742c02347bc0e980a01041f333bce120`, CPU INT8, two threads.

| Run | Processing | Model load | Total | Peak Python RSS | Persisted segments |
| --- | ---: | ---: | ---: | ---: | ---: |
| Local weights, offline library flags | 98.055 s | 0.611 s | 98.666 s | 1,617,248,256 bytes | 107 |
| OS-blocked outbound traffic, localhost allowed | 112.803 s | 0.683 s | 113.486 s | 1,482,063,872 bytes | 107 |

Both runs completed through Worker.reconcile(), claim(), process(), and publish().
MongoDB readback verified contiguous indices, chronological non-overlapping ranges,
nonempty text, timestamps within the video duration, and no duplicate claim.
The full disposable course record, including manual transcript and topics, remained
identical. Production/staging records were never accessed. Both source hashes were:
`017fe8d7a432139d2c531792f2989838accfc26c9af9acefb5510b64f9bb25e3`.
The retained offline output is `.cache/transcription-validation/offline.json`;
its stderr file is empty. Temporary MongoDB processes/data were cleaned up.

The initial restricted execution could not bind a localhost port; it was rerun
with permission for disposable local MongoDB. An intermediate offline process
handle was lost, so its result was not counted; the offline test was repeated with
retained output and exited successfully. No worker runtime fix was needed. The
only test change was an explicit duration override for this >600-second lecture.
These results establish pipeline persistence and offline execution, not a formal
word-error-rate evaluation or a live browser playback test.

## Milestone 2: local topic suggestions

`topic_worker.py` is a separate CPU process using the same MongoDB and lease/retry
protocol. It discovers completed transcripts every 30 seconds, including existing
completed jobs for current media, and upserts one suggestion job per transcript
result token, algorithm version, and embedding model revision. Upload and playback
never wait for embeddings. No changes to Gemini or the confusion service are needed.

The worker combines adjacent segments into roughly 25-second, at most 90-word
windows. Cosine changes between neighboring two-window means identify local peaks
above an absolute/adaptive threshold. Strongest boundaries win, with at least 60
seconds on both sides and at most 50 topics. Short lectures remain one topic.
Empty/noise-only transcripts produce no invented topics. Titles rank extractive
phrases (up to three content words with connecting words) by repetition, length,
and distinctiveness across topics. Up to 64 candidates per topic are reranked for
semantic relevance with the same local encoder; there is no generative model.
Parameters and transcript/model provenance are saved. The algorithm identifier is
`semantic-windows-v2` so earlier experimental titles remain distinguishable.

Suggestions live in `topic_suggestions`, independently of `Course.lessons.topics`.
Generated topics remain immutable through review; edits change only `draftTopics`.
Publication uses a MongoDB transaction with writes on Course and TranscriptionJob
to serialize source replacement/regeneration. A hidden `topicSuggestionRevision`
counter fences publication without changing lesson content or the client course
version. Lease ownership also fences crashed/reclaimed attempts. MongoDB must be a
replica set (the existing curriculum transaction APIs already require this).
The worker account needs course counter and transcription fence writes in addition
to read access and suggestion collection writes. It needs no media filesystem access.

### Explicit model provisioning and startup

Use an isolated environment; no model weights download during worker/backend startup.
Run the provisioning command once with network access, then restrict inference to
local files. Keep the directory and its immutable `REVISION` file together.

```sh
python3 -m venv transcription-worker/.venv-topics
transcription-worker/.venv-topics/bin/python -m pip install -r transcription-worker/requirements-topics.txt
transcription-worker/.venv-topics/bin/python transcription-worker/provision_topic_model.py \
  --directory transcription-worker/models/all-MiniLM-L6-v2 \
  --revision 1110a243fdf4706b3f48f1d95db1a4f5529b4d41

export TOPIC_MODEL_PATH="$PWD/transcription-worker/models/all-MiniLM-L6-v2"
export TOPIC_MODEL_REVISION="$(cat "$TOPIC_MODEL_PATH/REVISION")"
# Set MONGO_URI and MONGO_DB_NAME to the same database as the backend.
transcription-worker/.venv-topics/bin/python -B transcription-worker/topic_worker.py
```

Startup requires a complete local directory, checks its recorded revision, disables
remote code, and loads with `local_files_only=True` plus offline library flags.
See the [Sentence Transformers API](https://www.sbert.net/docs/package_reference/sentence_transformer/model.html).
For host-enforced isolation on macOS, prefix the worker with the sandbox-exec profile
above when MongoDB is local. A remote MongoDB deployment needs its own restricted
egress policy; do not interpret library flags as OS network enforcement.

### Tutor review API

All endpoints require the authenticated owning tutor. Base path:
`/api/tutor/courses/:courseId/lessons/:lessonId/topic-suggestions`.

- `GET`: current generation/review status, model/algorithm revision, provenance,
  generated/draft ranges, suggestion ID, reviewRevision, and courseVersion.
  Reads use a consistent snapshot of media, transcript, and suggestions.
- `PATCH /:suggestionId`: `{ "reviewRevision": 0, "topics": [...] }` edits the draft.
- `POST /:suggestionId/accept`: `{ "reviewRevision": 1 }` accepts the draft.
- `POST /:suggestionId/reject`: `{ "reviewRevision": 1 }` rejects it.

Every mutation requires `X-Course-Version` from the latest GET. Use returned
versions for subsequent operations. Stale versions or non-pending suggestions
return 409; missing course version returns 428. Validation uses `lessonTopics.js`
including chronological/non-overlapping ranges, title limits, and lesson duration.
Acceptance appends fresh IDs and preserves all existing IDs and ranges. If manual
topics overlap the draft, acceptance returns 409: edit the draft into available
gaps or reject it. Acceptance unpublishes the course for existing moderation flow.
No confusion events are rewritten or retroactively assigned to the new topics.

### Automated and real-model tests

```sh
RUN_TOPIC_SUGGESTION_TESTS=true \
TOPIC_TEST_PYTHON="$PWD/transcription-worker/.venv-topics/bin/python" \
node --test backend/tests/topicSuggestions.test.js

/usr/bin/sandbox-exec -p '(version 1) (allow default) (deny network-outbound) (allow network-outbound (remote ip "localhost:*"))' \
  transcription-worker/.venv/bin/python -B transcription-worker/tests/real_inference.py \
  --video backend/uploads/course-videos/e6af9f76-508d-4890-8a8b-87fb71981a9e.mp4 \
  --model transcription-worker/models/faster-whisper-small \
  --revision 536b0662742c02347bc0e980a01041f333bce120 \
  --max-video-seconds 660 --expected-segments 107 \
  --topic-model transcription-worker/models/all-MiniLM-L6-v2 \
  --topic-revision 1110a243fdf4706b3f48f1d95db1a4f5529b4d41 \
  --topic-python transcription-worker/.venv-topics/bin/python \
  --assert-network-blocked
```

These runners create disposable local replica sets and synthetic course records;
they never load application database credentials. The real runner opens the existing
lecture read-only, regenerates its 107 segments in the scratch database, and reports
topic ranges alongside full transcript evidence for human assessment. It verifies
source hash, manual content preservation, persistence, and duplicate reconciliation.

Validation on 2026-09-26: backend suite **156 passed, 8 opt-in tests skipped**;
dedicated topic integration **5 Node tests and 11 Python tests passed**; Milestone 1
integration **2 Node tests passed**, with **12 Python tests passed and 6 topic
database tests skipped** in that runner (covered by the dedicated topic suite).
Backend syntax checks and `git diff --check` passed. The topic suite includes an
actual transaction conflict induced after its publication snapshot, successful
transient-failure recovery, replacement inside encoding, concurrent claims and
acceptance, invalid embeddings, and manual topic/event preservation.

### Real lecture result and content assessment

The final `semantic-windows-v2` run passed with OS-enforced outbound blocking:
107 persisted segments from the 636.52284-second algorithms lecture, 30 semantic
windows, and 5 chronological non-overlapping suggestions. MiniLM loaded in **3.277
seconds**; topic processing, extractive ranking, and MongoDB persistence took
**0.427 seconds**. Peak topic-process RSS was **506,478,592 bytes**. Whisper
regeneration took 98.604 seconds separately. These are one-run measurements, not
throughput guarantees or combined system-memory measurements.

| Seconds | Generated title | Assessment against the timestamped transcript |
| --- | --- | --- |
| 0–122.80 | Assignment symbol — Syntax | Relevant to pseudocode notation, but narrower than the full section on writing algorithms. |
| 122.80–336.95 | After writing the algorithms — Analyze an algorithm | Correct analysis section; title is awkward and underspecifies time, space, network, power, and registers. |
| 336.95–488.14 | Statement in an algorithm — Machine code | Relevant to unit-time statement costs and the optional machine-code detail. |
| 488.14–569.89 | Detail analysis — Analyze | Captures the travel-versus-Mars analogy about analysis depth, but splitting this aside into a topic is debatable. The range also contains the start of space analysis. |
| 569.89–636.07 | Constant — Bytes | Grounded in constant space and words versus bytes, but too terse. The boundary comes after the space-analysis introduction. |

The first two major transitions are useful navigation points. The analogy and late
space-analysis boundary need tutor adjustment. Titles are extractive and grounded,
but are not polished lesson headings. This assessment uses the full timestamped
ASR transcript, not an independent listening study or a labeled boundary benchmark.
Useful tutor edits would be “Writing algorithms and pseudocode”, “Algorithm analysis
criteria”, “Time analysis and statement costs”, and “Space analysis and constant
complexity”, merging the analogy into the time-analysis section as appropriate.
Those editorial examples are not automatic generated output.

The final machine-readable output and complete transcript evidence are retained at
`.cache/transcription-validation/topics-final-offline.json`; stderr is empty.
The source SHA-256 remained
`017fe8d7a432139d2c531792f2989838accfc26c9af9acefb5510b64f9bb25e3`.
Manual lesson content remained identical, and the disposable database was removed.
An earlier run exposed filler-heavy titles; semantic extractive reranking improved
them but did not eliminate the need for review. An initial test-harness failure
from resolving the venv Python symlink was fixed before this successful final run.

Limitations: English-focused model/title extraction, segment-level rather than
word-level boundaries, heuristic title quality, and no tutor review UI in this
milestone (review is available through the API). Repeated phrases/ASR errors can
distort titles. A startup model configuration failure requires operator correction;
per-job inference failures retry three times with backoff. Exhausted jobs need
operator intervention; no retry endpoint is included. Old jobs/segments are retained
and reconciliation scans completed transcripts; add retention and incremental scans
before large-scale use. Model/algorithm changes intentionally generate a new review
batch. No deployment or production/staging data test is included.

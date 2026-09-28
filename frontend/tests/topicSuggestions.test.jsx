import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";
register("./ignoreStyles.mjs", import.meta.url);
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
const { render, cleanup, screen, fireEvent, waitFor, act } = await import("@testing-library/react");
const { default: TopicSuggestions } = await import("../src/components/TopicSuggestions.jsx");
const { default: LessonManager } = await import("../src/components/LessonManager.jsx");
const { useState } = await import("react");
const { establishSession, clearSession } = await import("../src/utils/authClient.js");
const { generationStatus, pollSuggestions, transcriptExcerpt, validateSuggestionDraft } = await import("../src/utils/topicSuggestions.js");

const topic = { title: "Sorting algorithms", startTimeSeconds: 30, endTimeSeconds: 90 };
const completed = () => ({ status: "completed", suggestionId: "s1", mediaVersion: "v1", reviewStatus: "pending", reviewRevision: 0, courseVersion: 7, draftTopics: [{ ...topic }], generatedTopics: [{ ...topic }] });
const transcript = () => ({ status: "completed", mediaVersion: "v1", completedAt: "2026-09-26", modelRevision: "test", segmentCount: 1, segments: [{ index: 0, startTimeSeconds: 30, endTimeSeconds: 40, text: "Insertion sort keeps an ordered prefix." }], nextOffset: null });
let suggestions, speech, calls, respond, previewed, dirty, props;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  establishSession({ id: "tutor", role: "tutor" }, "test-token");
  suggestions = completed(); speech = transcript(); calls = []; previewed = []; dirty = [];
  props = { courseId: "course", courseVersion: 7, lesson: { _id: "lesson", duration: "02:00", topics: [{ _id: "manual", title: "Manual intro", startTimeSeconds: 0, endTimeSeconds: 30 }] }, lessonDirty: false, disabled: false, canPreview: true, onPreview: seconds => previewed.push(seconds), onDirty: value => dirty.push(value), onReview: operation => operation(), onReload: () => {} };
  respond = async (url, options) => {
    if (options.method) {
      const body = JSON.parse(options.body);
      suggestions = { ...suggestions, courseVersion: suggestions.courseVersion + 1, reviewRevision: suggestions.reviewRevision + 1,
        ...(options.method === "PATCH" ? { draftTopics: body.topics } : { reviewStatus: url.endsWith("/accept") ? "accepted" : "rejected" }) };
      return json(suggestions);
    }
    return json(url.includes("/transcription") ? speech : suggestions);
  };
  globalThis.fetch = async (url, options = {}) => { calls.push({ url: String(url), ...options }); return respond(String(url), options); };
});
afterEach(() => { cleanup(); clearSession(); });
const mount = extra => render(<TopicSuggestions {...props} {...extra} />);
const ready = async () => screen.findByLabelText("Suggested title 1");
const disabled = button => button.matches(":disabled");

test("renders actual queued, processing, completed, failed, superseded and unavailable states", async () => {
  for (const [status, label] of [["queued", "Queued"], ["processing", "Processing"], ["completed", "Completed"], ["failed", "Failed"], ["superseded", "Unavailable"], ["not_requested", "Not requested"]]) {
    speech = { ...transcript(), status }; suggestions = { ...completed(), status };
    const view = mount();
    await screen.findByText(`Transcription: ${label}`);
    assert.ok(screen.getByText(`Topics: ${label}`));
    view.unmount();
  }
  assert.equal(generationStatus({ status: "awaiting_transcript" }, "topics").label, "Waiting for transcript");
  assert.equal(generationStatus({ status: "future_status" }, "topics").label, "Unavailable");
});

test("shows empty/no-speech results without enabling acceptance", async () => {
  speech = { ...transcript(), segmentCount: 0, segments: [] };
  suggestions = { ...completed(), draftTopics: [], generatedTopics: [] };
  mount();
  await screen.findByText("No speech was found in this transcript.");
  assert.ok(screen.getByText(/No usable topics were found/));
  assert.ok(disabled(screen.getByRole("button", { name: "Accept suggestions" })));
  assert.match(generationStatus({ status: "failed", errorCode: "no_speech" }, "transcript").text, /No speech/);
});

test("previews the video timestamp and available transcript without editing manual topics", async () => {
  mount(); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Preview at 00:30" }));
  await screen.findByText("Insertion sort keeps an ordered prefix.");
  assert.deepEqual(previewed, [30]);
  assert.equal(props.lesson.topics[0]._id, "manual");
  assert.ok(screen.getByText(/Accepting adds 1 topics alongside 1 existing topics/));
});

test("edits titles and times, validates ranges, and PATCHes only the draft with both versions", async () => {
  mount(); const input = await ready();
  fireEvent.change(input, { target: { value: "Reviewed sorting" } });
  fireEvent.change(screen.getByLabelText("Suggestion 1 end (MM:SS)"), { target: { value: "00:20" } });
  assert.ok(screen.getByText(/end after the start/));
  assert.ok(disabled(screen.getByRole("button", { name: "Save suggestion edits" })));
  fireEvent.change(screen.getByLabelText("Suggestion 1 end (MM:SS)"), { target: { value: "01:40.125" } });
  assert.ok(disabled(screen.getByRole("button", { name: "Accept suggestions" })));
  fireEvent.click(screen.getByRole("button", { name: "Save suggestion edits" }));
  await waitFor(() => assert.equal(calls.filter(c => c.method === "PATCH").length, 1));
  const request = calls.find(c => c.method === "PATCH");
  assert.equal(new Headers(request.headers).get("X-Course-Version"), "7");
  assert.equal(new Headers(request.headers).get("Authorization"), "Bearer test-token");
  assert.deepEqual(JSON.parse(request.body), { reviewRevision: 0, topics: [{ ...topic, title: "Reviewed sorting", endTimeSeconds: 100.125 }] });
  assert.ok(dirty.includes(true));
  assert.equal(props.lesson.topics[0].title, "Manual intro");
});

test("overlaps block acceptance but allow saving a draft; removing suggestions is supported", async () => {
  suggestions.draftTopics[0].startTimeSeconds = 20;
  mount(); await ready();
  assert.ok(screen.getByText(/Overlaps existing topics: Manual intro/));
  assert.ok(disabled(screen.getByRole("button", { name: "Accept suggestions" })));
  fireEvent.click(screen.getByRole("button", { name: "Remove suggestion 1" }));
  assert.ok(screen.getByText("No suggestions remain in this draft."));
  assert.ok(!disabled(screen.getByRole("button", { name: "Save suggestion edits" })));
});

test("acceptance and rejection use the existing batch endpoints and show terminal review status", async () => {
  for (const action of ["accept", "reject"]) {
    suggestions = completed();
    const view = mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: action === "accept" ? "Accept suggestions" : "Reject suggestions" }));
    await screen.findByText(action === "accept" ? /Suggestions accepted\./ : /Suggestions rejected\./);
    const request = calls.find(c => c.url.endsWith(`/${action}`));
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(request.body), { reviewRevision: 0 });
    assert.deepEqual(props.lesson.topics, [{ _id: "manual", title: "Manual intro", startTimeSeconds: 0, endTimeSeconds: 30 }]);
    view.unmount();
  }
});

test("401, 403, 404 and service errors show actionable errors without review controls", async () => {
  for (const [status, message] of [[401, /Sign in again/], [403, /owning tutor/], [404, /no longer available/], [503, /Service unavailable/]]) {
    respond = async () => json({ message: "Service unavailable" }, status);
    const view = mount();
    await screen.findByText(message);
    assert.equal(screen.queryByRole("button", { name: "Accept suggestions" }), null);
    view.unmount();
  }
});

test("409 and 428 preserve local edits and require explicit reload", async () => {
  for (const status of [409, 428]) {
    suggestions = completed();
    respond = async (url, options) => options.method ? json({ message: "The course changed." }, status) : json(url.includes("transcription") ? speech : suggestions);
    let reloaded = 0;
    const view = mount({ onReload: () => reloaded++ });
    const input = await ready();
    fireEvent.change(input, { target: { value: "Keep this local title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save suggestion edits" }));
    await screen.findByText(/Your local suggestion edits have been kept/);
    assert.equal(input.value, "Keep this local title");
    assert.ok(disabled(screen.getByRole("button", { name: "Accept suggestions" })));
    fireEvent.click(screen.getByRole("button", { name: "Reload saved lesson" }));
    assert.equal(reloaded, 1);
    view.unmount();
  }
});

test("refresh detects replacement and concurrent review without overwriting a dirty suggestion", async () => {
  mount(); const input = await ready();
  fireEvent.change(input, { target: { value: "Unsaved title" } });
  suggestions = { ...completed(), suggestionId: "new-job", mediaVersion: "v2", courseVersion: 8 };
  speech = { ...transcript(), mediaVersion: "v2" };
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
  await screen.findByText(/lesson, media, transcript, or review changed/);
  assert.equal(input.value, "Unsaved title");
  assert.ok(disabled(screen.getByRole("button", { name: "Accept suggestions" })));
});

test("unsaved lesson changes disable review and unmount aborts pending requests", async () => {
  const view = mount({ lessonDirty: true }); await ready();
  assert.ok(screen.getByText(/Save or cancel your lesson changes/));
  assert.ok(disabled(screen.getByRole("button", { name: "Accept suggestions" })));
  view.unmount();
  const pending = [];
  respond = async (_url, options) => { pending.push(options.signal); return new Promise(() => {}); };
  const loading = mount();
  await waitFor(() => assert.equal(pending.length, 2));
  loading.unmount();
  assert.ok(pending.every(signal => signal.aborted));
});

test("polling waits 10 seconds, never overlaps, and stops on cleanup or authorization failure", async () => {
  let scheduled, reads = 0, delivered = 0, signal;
  const timers = { setTimeout: (fn, delay) => { scheduled = fn; assert.equal(delay, 10000); return 42; }, clearTimeout: id => { assert.equal(id, 42); scheduled = null; } };
  const stop = pollSuggestions(async s => { signal = s; reads++; return {}; }, () => delivered++, () => {}, { timers });
  await act(async () => {});
  assert.equal(reads, 1); assert.equal(delivered, 1);
  await scheduled(); assert.equal(reads, 2);
  stop(); assert.ok(signal.aborted); assert.equal(scheduled, null);
  let failure;
  pollSuggestions(async () => { throw Object.assign(new Error("Forbidden"), { status: 403 }); }, () => {}, e => { failure = e; }, { timers: { setTimeout: () => assert.fail("Must not poll forbidden data"), clearTimeout: () => {} } });
  await act(async () => {}); assert.equal(failure.status, 403);
});

test("excerpt pagination reaches later topics and refuses a regenerated transcript", async () => {
  const first = { ...transcript(), segments: [{ startTimeSeconds: 0, endTimeSeconds: 10, text: "Intro" }], nextOffset: 200 };
  const offsets = [];
  assert.equal(await transcriptExcerpt(first, topic, async offset => { offsets.push(offset); return transcript(); }), "Insertion sort keeps an ordered prefix.");
  assert.deepEqual(offsets, [200]);
  await assert.rejects(transcriptExcerpt(first, topic, async () => ({ ...transcript(), completedAt: "new-result" })), /transcript changed/);
});

test("validation enforces backend title, duration, ordering and total-topic limits", () => {
  for (const topics of [[{ ...topic, title: "x".repeat(201) }], [{ ...topic, endTimeSeconds: 121 }], [topic, { ...topic, startTimeSeconds: 40 }], Array(201).fill(topic)]) {
    assert.ok(validateSuggestionDraft(topics, [], 120).error);
  }
  assert.ok(validateSuggestionDraft([topic], Array(200).fill({ title: "Existing", startTimeSeconds: 0, endTimeSeconds: 1 }), 120).conflict);
});

test("lesson manager reloads accepted topics and saves with the new course version and original manual ID", async () => {
  let savedDraft;
  const lesson = { ...props.lesson, title: "Algorithms", resources: [] };
  const initial = { _id: "course", slug: "course", name: "Course", __v: 7, lessons: [lesson] };
  function Harness() {
    const [course, setCourse] = useState(initial);
    return <LessonManager course={course} form={{ resources: [] }} setForm={() => {}} close={() => {}} reload={async () => {
      const next = { ...course, __v: suggestions.courseVersion, lessons: [{ ...lesson, topics: [...lesson.topics, { ...topic, _id: "accepted-topic" }] }] };
      setCourse(next); return next;
    }} update={async (_id, draft) => { savedDraft = draft; return course; }} />;
  }
  render(<Harness />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Accept suggestions" }));
  await screen.findByText("Suggested topics added");
  const topicTitles = screen.getAllByPlaceholderText("e.g. Understanding variables");
  assert.deepEqual(topicTitles.map(input => input.value), ["Manual intro", "Sorting algorithms"]);
  fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
  await waitFor(() => assert.ok(savedDraft));
  assert.equal(savedDraft.courseVersion, 8);
  assert.deepEqual(savedDraft.topics.map(t => t._id), ["manual", "accepted-topic"]);
});

test("lesson manager asks before discarding suggestion edits on close or lesson switch", async () => {
  let closes = 0, confirmations = 0;
  const oldConfirm = window.confirm;
  window.confirm = () => { confirmations++; return false; };
  try {
    render(<LessonManager course={{ _id: "course", slug: "course", name: "Course", __v: 7, lessons: [{ ...props.lesson, title: "First", resources: [] }, { ...props.lesson, _id: "second", title: "Second", resources: [] }] }} form={{ resources: [] }} setForm={() => {}} close={() => closes++} />);
    fireEvent.change(await ready(), { target: { value: "Preserve this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: /02 Second/ }));
    assert.equal(closes, 0); assert.equal(confirmations, 2);
    assert.equal(screen.getByLabelText("Suggested title 1").value, "Preserve this draft");
  } finally { window.confirm = oldConfirm; }
});

test('older saved video requests generation with authentication and current course version', async () => {
  speech = { status: 'not_requested', segments: [] }; suggestions = { status: 'awaiting_transcript', courseVersion: 7 };
  respond = async (url, options) => {
    if (options.method === 'POST') { speech = { status: 'queued', segments: [] }; return json({ generationRequested: true, status: 'queued' }, 202); }
    return json(url.includes('/transcription') ? speech : suggestions);
  };
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Generate transcript and topics' }));
  await screen.findByText('Transcription: Queued');
  const request = calls.find(call => call.method === 'POST');
  assert.ok(request.url.endsWith('/transcription'));
  assert.equal(new Headers(request.headers).get('X-Course-Version'), '7');
  assert.equal(new Headers(request.headers).get('Authorization'), 'Bearer test-token');
  assert.equal(screen.queryByRole('button', { name: 'Generate transcript and topics' }), null);
});

test('generation refuses unsaved lesson changes and shows missing file, authorization and stale-version errors', async () => {
  for (const status of [422, 409, 403, 401]) {
    speech = { status: 'not_requested', segments: [] }; suggestions = { status: 'awaiting_transcript', courseVersion: 7 };
    respond = async (url, options) => options.method ? json({ message: status === 422 ? 'The original video file is unavailable on this server.' : 'The lesson changed. Reload before generating.' }, status) : json(url.includes('/transcription') ? speech : suggestions);
    const view = mount({ lessonDirty: true });
    assert.ok(disabled(await screen.findByRole('button', { name: 'Generate transcript and topics' })));
    view.rerender(<TopicSuggestions {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate transcript and topics' }));
    await waitFor(() => assert.ok(screen.getAllByRole('alert').length));
    if (status === 422) assert.ok(screen.getByText('The original video file is unavailable on this server.'));
    else assert.ok(disabled(screen.getByRole('button', { name: 'Generate transcript and topics' })));
    view.unmount();
  }
});

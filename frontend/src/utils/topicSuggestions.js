import { API_ROOT } from "./courseApi.js";
import { sessionFetch } from "./authClient.js";
import { topicPayload } from "./lessonEditor.js";

export const TOPIC_POLL_MS = 10000;
export const suggestionPath = (courseId, lessonId) => `${API_ROOT}/tutor/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`;

export async function topicRequest(path, options = {}, sessionVersion) {
  const response = await sessionFetch(path, options, sessionVersion);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages = { 401: "Your session has expired. Sign in again.", 403: "Only the owning tutor can review this lesson.", 404: "This lesson is no longer available to your account." };
    throw Object.assign(new Error(messages[response.status] || data.message || "Suggestions are temporarily unavailable. Try refreshing."), { status: response.status });
  }
  return data;
}

export function generationStatus(job, kind) {
  const name = kind === "transcript" ? "Transcription" : "Topic suggestions";
  switch (job?.status) {
    case "queued": return { label: "Queued", text: `${name} will start when the worker is available.` };
    case "processing": return { label: "Processing", text: `${name} are being prepared.` };
    case "completed": return { label: "Completed", text: kind === "transcript" && job.segmentCount === 0 ? "No speech was found in this transcript." : `${name} are ready.` };
    case "failed": return { label: "Failed", text: job.errorCode === "no_speech" ? "No speech was detected in the video." : `${name} could not be completed. Contact your administrator to retry.` };
    case "awaiting_transcript": return { label: "Waiting for transcript", text: "Topics will be suggested after transcription completes." };
    case "superseded": return { label: "Unavailable", text: "The source changed. Reload the saved lesson." };
    case "not_requested": return { label: "Not requested", text: "No transcription has been requested for this saved video. Generate one below if its original local file is available." };
    default: return { label: job ? "Unavailable" : "Loading", text: job ? `${name} are unavailable.` : `Checking ${name.toLowerCase()}…` };
  }
}

export function reviewIdentity(snapshot) {
  const s = snapshot?.suggestion;
  return JSON.stringify([s?.suggestionId, s?.mediaVersion, s?.reviewRevision, s?.reviewStatus, s?.courseVersion, snapshot?.transcript?.completedAt]);
}

export function validateSuggestionDraft(topics, manual, duration) {
  try {
    const payload = topicPayload(topics, duration).map(({ title, startTimeSeconds, endTimeSeconds }) => ({ title, startTimeSeconds, endTimeSeconds }));
    const conflicts = manual.filter(m => payload.some(p => p.startTimeSeconds < m.endTimeSeconds && p.endTimeSeconds > m.startTimeSeconds));
    return { payload, error: "", conflict: conflicts.length ? `Overlaps existing topics: ${conflicts.map(t => t.title).join(", ")}. Edit or remove these suggestions before accepting.` : manual.length + payload.length > 200 ? "Accepting would exceed the limit of 200 lesson topics." : "" };
  } catch (error) { return { payload: [], error: error.message, conflict: "" }; }
}

const transcriptIdentity = page => JSON.stringify([page.mediaVersion, page.completedAt, page.modelRevision, page.segmentCount]);
export async function transcriptExcerpt(first, topic, readPage) {
  let page = first;
  const seen = new Set();
  while (page) {
    if (page.status !== "completed" || transcriptIdentity(page) !== transcriptIdentity(first)) throw new Error("The transcript changed. Refresh before previewing it.");
    const segments = (page.segments || []).filter(s => s.endTimeSeconds > topic.startTimeSeconds && s.startTimeSeconds < topic.endTimeSeconds);
    if (segments.length) return segments.slice(0, 3).map(s => s.text).join(" ");
    if (page.nextOffset == null || page.segments?.at(-1)?.startTimeSeconds >= topic.endTimeSeconds) return "";
    if (!Number.isSafeInteger(page.nextOffset) || page.nextOffset < 0 || seen.has(page.nextOffset)) throw new Error("Transcript pagination is unavailable.");
    seen.add(page.nextOffset);
    page = await readPage(page.nextOffset);
  }
  return "";
}

// Recursive timeout avoids overlapping network polls. Cleanup aborts active work.
export function pollSuggestions(read, receive, fail, { delay = TOPIC_POLL_MS, timers = globalThis } = {}) {
  const controller = new AbortController();
  let timer;
  const run = async () => {
    try { const result = await read(controller.signal); if (!controller.signal.aborted) receive(result); }
    catch (error) { if (!controller.signal.aborted) { fail(error); if ([401, 403, 404].includes(error.status) || error.name === "AbortError") return; } }
    if (!controller.signal.aborted) timer = timers.setTimeout(run, delay);
  };
  void run();
  return () => { controller.abort(); timers.clearTimeout(timer); };
}

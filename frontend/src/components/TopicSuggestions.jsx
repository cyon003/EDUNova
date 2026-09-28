import { useEffect, useRef, useState } from "react";
import TopicTimeInput from "./TopicTimeInput.jsx";
import { getAuthSnapshot } from "../utils/authClient.js";
import { lessonDurationSeconds } from "../utils/courseApi.js";
import { formatTopicTime } from "../utils/topicTime.js";
import { generationStatus, pollSuggestions, reviewIdentity, suggestionPath, topicRequest, transcriptExcerpt, validateSuggestionDraft } from "../utils/topicSuggestions.js";

export default function TopicSuggestions({ courseId, courseVersion, lesson, lessonDirty, disabled, canPreview, onPreview, onDirty, onReview, onReload }) {
  const [sessionVersion] = useState(() => getAuthSnapshot().version);
  const [state, setState] = useState({ snapshot: null, topics: [], edited: false, stale: false, error: "" });
  const [refresh, setRefresh] = useState(0);
  const [writing, setWriting] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [preview, setPreview] = useState(null);
  const active = useRef(false);
  const previewRequest = useRef(null);
  const mutation = useRef(null);
  const path = suggestionPath(courseId, lesson._id);
  const snapshot = state.snapshot;
  const suggestion = snapshot?.suggestion;
  const transcript = snapshot?.transcript;
  const identity = reviewIdentity(snapshot);
  const mismatch = suggestion?.courseVersion != null && suggestion.courseVersion !== courseVersion;
  const mediaMismatch = suggestion?.mediaVersion && transcript?.mediaVersion && suggestion.mediaVersion !== transcript.mediaVersion;
  const stale = state.stale || mismatch || mediaMismatch;
  const blocked = disabled || writing || lessonDirty || stale || Boolean(state.error);
  const pending = suggestion?.status === "completed" && suggestion.reviewStatus === "pending";
  const validation = validateSuggestionDraft(state.topics, lesson.topics || [], lessonDurationSeconds(lesson));

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; previewRequest.current?.abort(); mutation.current?.abort(); };
  }, []);
  useEffect(() => { onDirty(state.edited); return () => onDirty(false); }, [onDirty, state.edited]);
  useEffect(() => () => previewRequest.current?.abort(), [identity]);
  useEffect(() => {
    if (disabled || writing) return undefined;
    return pollSuggestions(async signal => {
      const [transcript, suggestion] = await Promise.all([
        topicRequest(`${path}/transcription`, { signal }, sessionVersion),
        topicRequest(`${path}/topic-suggestions`, { signal }, sessionVersion),
      ]);
      return { transcript, suggestion };
    }, next => setState(current => ({
      ...current, snapshot: next, error: "",
      stale: current.stale || (current.edited && reviewIdentity(current.snapshot) !== reviewIdentity(next)),
      topics: current.edited ? current.topics : (next.suggestion.draftTopics || []),
    })), error => setState(current => ({ ...current, error: error.name === "AbortError" ? "Your account changed. Reopen the lesson editor." : error.message })));
  }, [path, sessionVersion, disabled, writing, refresh]);

  const edit = (index, field, value) => {
    previewRequest.current?.abort();
    setPreview(null);
    setState(current => ({ ...current, edited: true, topics: current.topics.map((topic, i) => i === index ? { ...topic, [field]: value } : topic) }));
  };
  const generate = async () => {
    setGenerationError("");
    if (blocked || mutation.current || state.edited) return;
    const controller = new AbortController();
    mutation.current = controller;
    setWriting(true);
    try {
      await onReview(() => topicRequest(`${path}/transcription`, {
        method: "POST", signal: controller.signal,
        headers: { "X-Course-Version": String(courseVersion) },
      }, sessionVersion));
      if (active.current) setRefresh(value => value + 1);
    } catch (error) {
      if (active.current) {
        setGenerationError(error.message);
        if ([409, 428, 401, 403].includes(error.status)) setState(current => ({ ...current, stale: true }));
      }
    } finally {
      mutation.current = null;
      if (active.current) setWriting(false);
    }
  };
  const review = async action => {
    if (blocked || !pending || mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    setWriting(true);
    try {
      await onReview(async () => {
        const result = await topicRequest(`${path}/topic-suggestions/${encodeURIComponent(suggestion.suggestionId)}${action === "edit" ? "" : `/${action}`}`, {
          method: action === "edit" ? "PATCH" : "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", "X-Course-Version": String(suggestion.courseVersion) },
          body: JSON.stringify({ reviewRevision: suggestion.reviewRevision, ...(action === "edit" ? { topics: validation.payload } : {}) }),
        }, sessionVersion);
        if (active.current) setState(current => ({ ...current, snapshot: { ...current.snapshot, suggestion: result }, topics: result.draftTopics || [], edited: false }));
        return result;
      });
    } catch (error) {
      if (active.current) setState(current => ({ ...current, stale: true, error: `${error.message} Your local suggestion edits have been kept. Reload the saved lesson before trying again.` }));
    } finally {
      mutation.current = null;
      if (active.current) setWriting(false);
    }
  };
  const showPreview = async index => {
    previewRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    const topic = validation.payload[index];
    if (!topic || stale) return;
    if (canPreview) onPreview(topic.startTimeSeconds);
    setPreview({ index, identity, text: "Loading transcript excerpt…" });
    try {
      const text = transcript?.status === "completed" && transcript.mediaVersion === suggestion.mediaVersion
        ? await transcriptExcerpt(transcript, topic, offset => topicRequest(`${path}/transcription?offset=${offset}`, { signal: controller.signal }, sessionVersion)) : "";
      if (!controller.signal.aborted) setPreview({ index, identity, text: text || "No transcript excerpt is available for this range." });
    } catch (error) { if (!controller.signal.aborted) setPreview({ index, identity, text: error.message }); }
  };
  const transcriptStatus = generationStatus(transcript, "transcript");
  const topicStatus = generationStatus(suggestion, "topics");

  return <section className="lesson-topics lesson-suggestions" aria-label="Automatic topic suggestions" aria-busy={writing}>
    <header><div><h3>Automatic topic suggestions</h3><p>Review topics from the saved video’s transcript. Your existing topics stay in place.</p></div><button type="button" disabled={disabled || writing} onClick={() => setRefresh(value => value + 1)}>Refresh status</button></header>
    <div className="lesson-generation-status" aria-live="polite">
      <div><strong>Transcription: {transcriptStatus.label}</strong><p>{transcriptStatus.text}</p>{transcript?.errorCode && <small>Processing detail: {transcript.errorCode}</small>}</div>
      <div><strong>Topics: {topicStatus.label}</strong><p>{topicStatus.text}</p>{suggestion?.errorCode && <small>Processing detail: {suggestion.errorCode}</small>}</div>
    </div>
    {transcript?.status === "not_requested" && <div className="lesson-suggestion-actions"><button type="button" className="primary" disabled={blocked || state.edited} onClick={() => void generate()}>Generate transcript and topics</button><p>Uses the saved local main video. Your manual transcript, topics and quiz stay unchanged. Processing continues in the background while the workers are running.</p></div>}
    {generationError && <p className="lesson-form-error" role="alert">{generationError}</p>}
    {lessonDirty && <p className="lesson-suggestion-notice">Save or cancel your lesson changes before reviewing suggestions. A selected replacement video has not been processed yet.</p>}
    {(stale || state.error) && <div className="lesson-form-error" role="alert"><p>{state.error || "The lesson, media, transcript, or review changed. Your local edits have been kept."}</p><button type="button" disabled={disabled || writing} onClick={onReload}>Reload saved lesson</button><small>Reload asks before discarding unsaved edits.</small></div>}
    {suggestion?.reviewStatus === "accepted" && <p role="status">Suggestions accepted. The added topics are in the lesson’s topic list. The course requires review before publication.</p>}
    {suggestion?.reviewStatus === "rejected" && <p role="status">Suggestions rejected. Your lesson topics have not changed.</p>}
    {(suggestion?.status === "completed" || state.edited) && <>
      {!state.topics.length && <p className="lesson-topics-empty">{suggestion.generatedTopics?.length ? "No suggestions remain in this draft." : "No usable topics were found. You can still add lesson topics manually."}</p>}
      <fieldset className="lesson-suggestion-fields" disabled={blocked}>
        <legend className="lesson-sr-only">Review suggested titles and ranges</legend>
        <div className="lesson-topic-list">{state.topics.map((topic, index) => <article className="lesson-topic-card" key={index}>
          <header><strong>Suggestion {index + 1}</strong>{pending && <button type="button" className="lesson-topic-remove" onClick={() => { setPreview(null); setState(current => ({ ...current, edited: true, topics: current.topics.filter((_, i) => i !== index) })); }}>Remove suggestion {index + 1}</button>}</header>
          <label className="lesson-topic-title">Suggested title {index + 1}<input disabled={!pending} maxLength={200} value={topic.title} onChange={event => edit(index, "title", event.target.value)} /></label>
          <div className="lesson-topic-times"><TopicTimeInput disabled={!pending} label={`Suggestion ${index + 1} start`} value={topic.startTimeSeconds} onChange={value => edit(index, "startTimeSeconds", value)} /><TopicTimeInput disabled={!pending} label={`Suggestion ${index + 1} end`} value={topic.endTimeSeconds} onChange={value => edit(index, "endTimeSeconds", value)} /></div>
          <button type="button" disabled={(!canPreview && transcript?.status !== "completed") || Boolean(validation.error)} onClick={() => void showPreview(index)}>{canPreview ? "Preview" : "Read excerpt"} at {formatTopicTime(topic.startTimeSeconds)}</button>
          {preview?.index === index && preview.identity === identity && <blockquote aria-live="polite">{preview.text}</blockquote>}
        </article>)}</div>
      </fieldset>
      {suggestion?.generatedTopics?.length > 0 && <details className="lesson-supporting-content"><summary>Original generated topics</summary><ol>{suggestion.generatedTopics.map((topic, index) => <li key={index}>{topic.title} · {formatTopicTime(topic.startTimeSeconds)}–{formatTopicTime(topic.endTimeSeconds)}</li>)}</ol></details>}
      {pending && <>
        {validation.error && <p role="alert" className="lesson-form-error">{validation.error}</p>}
        {validation.conflict ? <p role="alert" className="lesson-suggestion-notice">{validation.conflict}</p> : <p>Accepting adds {state.topics.length} topics alongside {lesson.topics?.length || 0} existing topics. Existing titles, ranges, and IDs are preserved.</p>}
        <p className="lesson-suggestion-notice">Accept and Reject apply to the entire batch. Acceptance returns the course to unpublished unless it is already rejected.</p>
        <div className="lesson-suggestion-actions">
          <button type="button" disabled={blocked || !state.edited || Boolean(validation.error)} onClick={() => void review("edit")}>Save suggestion edits</button>
          <button type="button" className="primary" disabled={blocked || state.edited || !state.topics.length || Boolean(validation.error || validation.conflict)} onClick={() => void review("accept")}>Accept suggestions</button>
          <button type="button" disabled={blocked || state.edited} onClick={() => void review("reject")}>Reject suggestions</button>
        </div>
        {state.edited && <p role="status">Save suggestion edits before accepting or rejecting. These edits do not change your lesson topics.</p>}
      </>}
    </>}
  </section>;
}

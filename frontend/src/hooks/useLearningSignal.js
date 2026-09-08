import { useCallback, useEffect, useRef, useState } from "react";
import { API_ROOT } from "../utils/courseApi.js";
import { isBackwardReplay, isStudentPause, LEARNING_SIGNAL_FLUSH_MS, maximumWatchedPercent, pendingSignalBody, shouldCountActiveTime, STRICT_MODE_VISIT_WINDOW_MS } from "../utils/learningSignalTracking.js";
import { useAuth } from "./useAuth.js";
import { isCurrentSession, sessionFetch } from "../utils/authClient.js";

const recentVisits = new Map();
const predictionRequests = new Map();
const emptySignal = { maximumVideoProgressPercent: 0, activeTimeSeconds: 0, pauseCount: 0, replayCount: 0, visitCount: 0, lessonCompleted: false, confusionFeedback: null };
const emptyPending = () => ({ maximumVideoProgressPercent: 0, activeTimeSecondsDelta: 0, pauseCountDelta: 0, replayCountDelta: 0, visitCountDelta: 0 });

export function useLearningSignal({ courseId, lessonId }) {
  const { user, version } = useAuth();
  const studentId = user?.role === "student" ? user.id : "";
  const [signal, setSignal] = useState(emptySignal);
  const [signalKey, setSignalKey] = useState("");
  const [feedbackState, setFeedbackState] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [predictionState, setPredictionState] = useState("idle");
  const pending = useRef(emptyPending());
  const target = useRef({ courseId: "", lessonId: "", key: "" });
  const flushRef = useRef(() => Promise.resolve());
  const predictRef = useRef(() => Promise.resolve(false));
  const meaningfulActivity = useRef(false);
  const lastPlaybackTime = useRef(0);
  const playing = useRef(false);
  const mediaIntentAt = useRef(0);

  const flush = useCallback(async ({ keepalive = false } = {}) => {
    const currentTarget = target.current;
    if (!currentTarget.key || !isCurrentSession(currentTarget.version)) return;
    const update = pending.current;
    const body = pendingSignalBody(update);
    if (!Object.keys(body).length) return;
    meaningfulActivity.current = true;
    pending.current = { maximumVideoProgressPercent: 0, activeTimeSecondsDelta: Math.max(0, update.activeTimeSecondsDelta - (body.activeTimeSecondsDelta || 0)), pauseCountDelta: Math.max(0, update.pauseCountDelta - (body.pauseCountDelta || 0)), replayCountDelta: Math.max(0, update.replayCountDelta - (body.replayCountDelta || 0)), visitCountDelta: Math.max(0, update.visitCountDelta - (body.visitCountDelta || 0)) };
    try {
      const response = await sessionFetch(`${API_ROOT}/learning-signals/${currentTarget.courseId}/${currentTarget.lessonId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive }, currentTarget.version);
      if (!response.ok) throw new Error("Learning activity could not be saved.");
      await response.json();
      if (target.current === currentTarget && isCurrentSession(currentTarget.version)) setTrackingError("");
    } catch (error) {
      if (target.current === currentTarget && isCurrentSession(currentTarget.version)) {
        pending.current.maximumVideoProgressPercent = Math.max(pending.current.maximumVideoProgressPercent, body.maximumVideoProgressPercent || 0);
        for (const field of ["activeTimeSecondsDelta", "pauseCountDelta", "replayCountDelta", "visitCountDelta"]) pending.current[field] += body[field] || 0;
        setTrackingError(error.message);
      }
    }
  }, []);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const requestPrediction = useCallback(async () => {
    const currentTarget = target.current;
    if (!studentId || !currentTarget.key || !meaningfulActivity.current || !isCurrentSession(version)) return false;
    const key = `${version}:${studentId}:${courseId}:${lessonId}`;
    if (signal.aiPrediction?.prediction || predictionRequests.has(key)) return false;
    const pendingRequest = (async () => {
      setPredictionState("loading");
      try {
        await flushRef.current();
        const response = await sessionFetch(`${API_ROOT}/learning-signals/${courseId}/${lessonId}/prediction`, { method: "POST" }, version);
        if (!response.ok) throw new Error("Confusion prediction could not be generated.");
        const prediction = await response.json();
        if (isCurrentSession(version)) { setSignal((current) => ({ ...current, aiPrediction: prediction })); setPredictionState("success"); }
        return true;
      } catch (error) {
        if (isCurrentSession(version)) { setPredictionState("error"); setTrackingError(error.message); }
        return false;
      } finally { predictionRequests.delete(key); }
    })();
    predictionRequests.set(key, pendingRequest);
    return pendingRequest;
  }, [courseId, lessonId, signal.aiPrediction?.prediction, studentId, version]);
  useEffect(() => { predictRef.current = requestPrediction; }, [requestPrediction]);

  useEffect(() => {
    if (!studentId || !courseId || !lessonId) return undefined;
    const key = `${version}:${studentId}:${courseId}:${lessonId}`;
    const visitKey = key;
    const currentTarget = { courseId, lessonId, key, version };
    target.current = currentTarget;
    pending.current = emptyPending();
    meaningfulActivity.current = false;
    lastPlaybackTime.current = 0;
    playing.current = false;
    const now = Date.now();
    if (now - (recentVisits.get(visitKey) || 0) > STRICT_MODE_VISIT_WINDOW_MS) { pending.current.visitCountDelta = 1; recentVisits.set(visitKey, now); }
    const controller = new AbortController();
    sessionFetch(`${API_ROOT}/learning-signals/${courseId}/${lessonId}`, { signal: controller.signal }, version)
      .then((response) => { if (!response.ok) throw new Error("Learning activity could not be restored."); return response.json(); })
      .then((saved) => { if (target.current === currentTarget && isCurrentSession(version)) { setSignal(saved); setSignalKey(key); setFeedbackState(""); setTrackingError(""); } })
      .catch((error) => { if (error.name !== "AbortError" && target.current === currentTarget && isCurrentSession(version)) setTrackingError(error.message); });
    const activeTimer = window.setInterval(() => { if (shouldCountActiveTime(document.visibilityState)) pending.current.activeTimeSecondsDelta += 1; }, 1000);
    const flushTimer = window.setInterval(() => flushRef.current(), LEARNING_SIGNAL_FLUSH_MS);
    const visibility = () => { if (document.visibilityState === "hidden") flushRef.current({ keepalive: true }); };
    const pageExit = () => flushRef.current({ keepalive: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageExit);
    return () => { controller.abort(); window.clearInterval(activeTimer); window.clearInterval(flushTimer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pageExit); void (async () => { await flushRef.current({ keepalive: true }); await predictRef.current(); })(); };
  }, [courseId, lessonId, studentId, version]);

  const recordMaximumProgress = useCallback((media) => {
    if (!Number.isFinite(media.duration) || media.duration <= 0) return;
    pending.current.maximumVideoProgressPercent = maximumWatchedPercent(pending.current.maximumVideoProgressPercent, media.currentTime, media.duration);
  }, []);
  const mediaHandlers = {
    onLoadedMetadata(event) { lastPlaybackTime.current = event.currentTarget.currentTime || 0; recordMaximumProgress(event.currentTarget); },
    onPlay() { playing.current = true; },
    onPointerDown() { mediaIntentAt.current = Date.now(); },
    onKeyDown(event) { if ([" ", "k", "K"].includes(event.key)) mediaIntentAt.current = Date.now(); },
    onTimeUpdate(event) { recordMaximumProgress(event.currentTarget); lastPlaybackTime.current = event.currentTarget.currentTime; },
    onSeeking(event) { const next = event.currentTarget.currentTime; if (isBackwardReplay(lastPlaybackTime.current, next)) pending.current.replayCountDelta += 1; lastPlaybackTime.current = next; },
    onPause(event) { if (isStudentPause({ wasPlaying: playing.current, intentAt: mediaIntentAt.current, ended: event.currentTarget.ended })) pending.current.pauseCountDelta += 1; playing.current = false; mediaIntentAt.current = 0; },
    onEnded() { playing.current = false; pending.current.maximumVideoProgressPercent = 100; meaningfulActivity.current = true; },
  };
  const saveFeedback = useCallback(async (feedback) => {
    if (!studentId || !courseId || !lessonId || feedbackState === "saving" || !isCurrentSession(version)) return;
    const currentTarget = target.current;
    setFeedbackState("saving"); setTrackingError("");
    try {
      const response = await sessionFetch(`${API_ROOT}/learning-signals/${courseId}/${lessonId}/feedback`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback }) }, version);
      if (!response.ok) throw new Error("Feedback could not be saved.");
      const saved = await response.json(); meaningfulActivity.current = true;
      if (target.current === currentTarget && isCurrentSession(version)) { setSignal(saved); setSignalKey(currentTarget.key); setFeedbackState("saved"); }
      await requestPrediction();
    } catch (error) { if (target.current === currentTarget && isCurrentSession(version)) { setFeedbackState("error"); setTrackingError(error.message); } }
  }, [courseId, feedbackState, lessonId, requestPrediction, studentId, version]);
  const currentKey = studentId && courseId && lessonId ? `${version}:${studentId}:${courseId}:${lessonId}` : "";
  return { signal: signalKey === currentKey ? signal : emptySignal, feedbackState, trackingError, predictionState, saveFeedback, requestPrediction, flush, mediaHandlers };
}

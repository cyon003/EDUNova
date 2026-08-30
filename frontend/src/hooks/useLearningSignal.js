import { useCallback, useEffect, useRef, useState } from "react";
import { API_ROOT } from "../utils/courseApi";
import { isBackwardReplay, isStudentPause, LEARNING_SIGNAL_FLUSH_MS, maximumWatchedPercent, pendingSignalBody, shouldCountActiveTime, STRICT_MODE_VISIT_WINDOW_MS } from "../utils/learningSignalTracking";

const recentVisits = new Map();
const emptySignal = { maximumVideoProgressPercent: 0, activeTimeSeconds: 0, pauseCount: 0, replayCount: 0, visitCount: 0, lessonCompleted: false, confusionFeedback: null };
const emptyPending = () => ({ maximumVideoProgressPercent: 0, activeTimeSecondsDelta: 0, pauseCountDelta: 0, replayCountDelta: 0, visitCountDelta: 0 });

export function useLearningSignal({ courseId, lessonId }) {
  const [signal, setSignal] = useState(emptySignal);
  const [signalKey, setSignalKey] = useState("");
  const [feedbackState, setFeedbackState] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const pending = useRef(emptyPending());
  const target = useRef({ courseId: "", lessonId: "", key: "" });
  const flushRef = useRef(() => Promise.resolve());
  const lastPlaybackTime = useRef(0);
  const playing = useRef(false);
  const mediaIntentAt = useRef(0);

  const flush = useCallback(async ({ keepalive = false } = {}) => {
    const currentTarget = target.current;
    if (!currentTarget.key) return;
    const update = pending.current;
    const body = pendingSignalBody(update);
    if (!Object.keys(body).length) return;
    pending.current = { maximumVideoProgressPercent: 0, activeTimeSecondsDelta: Math.max(0, update.activeTimeSecondsDelta - (body.activeTimeSecondsDelta || 0)), pauseCountDelta: Math.max(0, update.pauseCountDelta - (body.pauseCountDelta || 0)), replayCountDelta: Math.max(0, update.replayCountDelta - (body.replayCountDelta || 0)), visitCountDelta: Math.max(0, update.visitCountDelta - (body.visitCountDelta || 0)) };
    try {
      const response = await fetch(`${API_ROOT}/learning-signals/${currentTarget.courseId}/${currentTarget.lessonId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify(body), keepalive });
      if (!response.ok) throw new Error("Learning activity could not be saved.");
      await response.json();
      if (target.current.key === currentTarget.key) setTrackingError("");
    } catch (error) {
      if (target.current.key === currentTarget.key) {
        pending.current.maximumVideoProgressPercent = Math.max(pending.current.maximumVideoProgressPercent, body.maximumVideoProgressPercent || 0);
        for (const field of ["activeTimeSecondsDelta", "pauseCountDelta", "replayCountDelta", "visitCountDelta"]) pending.current[field] += body[field] || 0;
        setTrackingError(error.message);
      }
    }
  }, []);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  useEffect(() => {
    if (!courseId || !lessonId) return undefined;
    const key = `${courseId}:${lessonId}`;
    const visitKey = `${localStorage.getItem("token") || "anonymous"}:${key}`;
    target.current = { courseId, lessonId, key };
    pending.current = emptyPending();
    lastPlaybackTime.current = 0;
    playing.current = false;
    const now = Date.now();
    if (now - (recentVisits.get(visitKey) || 0) > STRICT_MODE_VISIT_WINDOW_MS) { pending.current.visitCountDelta = 1; recentVisits.set(visitKey, now); }
    const controller = new AbortController();
    fetch(`${API_ROOT}/learning-signals/${courseId}/${lessonId}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Learning activity could not be restored."); return response.json(); })
      .then((saved) => { if (target.current.key === key) { setSignal(saved); setSignalKey(key); setFeedbackState(""); setTrackingError(""); } })
      .catch((error) => { if (error.name !== "AbortError" && target.current.key === key) setTrackingError(error.message); });
    const activeTimer = window.setInterval(() => { if (shouldCountActiveTime(document.visibilityState)) pending.current.activeTimeSecondsDelta += 1; }, 1000);
    const flushTimer = window.setInterval(() => flushRef.current(), LEARNING_SIGNAL_FLUSH_MS);
    const visibility = () => { if (document.visibilityState === "hidden") flushRef.current({ keepalive: true }); };
    const pageExit = () => flushRef.current({ keepalive: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageExit);
    return () => { controller.abort(); window.clearInterval(activeTimer); window.clearInterval(flushTimer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pageExit); flushRef.current({ keepalive: true }); };
  }, [courseId, lessonId]);

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
    onEnded() { playing.current = false; pending.current.maximumVideoProgressPercent = 100; },
  };

  const saveFeedback = useCallback(async (feedback) => {
    if (!courseId || !lessonId || feedbackState === "saving") return;
    const key = `${courseId}:${lessonId}`;
    setFeedbackState("saving"); setTrackingError("");
    try {
      const response = await fetch(`${API_ROOT}/learning-signals/${courseId}/${lessonId}/feedback`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify({ feedback }) });
      if (!response.ok) throw new Error("Feedback could not be saved.");
      const saved = await response.json(); if (target.current.key === key) { setSignal(saved); setSignalKey(key); setFeedbackState("saved"); }
    } catch (error) { if (target.current.key === key) { setFeedbackState("error"); setTrackingError(error.message); } }
  }, [courseId, feedbackState, lessonId]);

  const currentKey = courseId && lessonId ? `${courseId}:${lessonId}` : "";
  return { signal: signalKey === currentKey ? signal : emptySignal, feedbackState, trackingError, saveFeedback, flush, mediaHandlers };
}

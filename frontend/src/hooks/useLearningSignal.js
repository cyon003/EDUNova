import { useCallback, useEffect, useRef, useState } from "react";
import { API_ROOT } from "../utils/courseApi.js";
import { isBackwardReplay, isStudentPause, LEARNING_SIGNAL_FLUSH_MS, maximumWatchedPercent, pendingSignalBody, shouldCountActiveTime, STRICT_MODE_VISIT_WINDOW_MS } from "../utils/learningSignalTracking.js";
import { canCheckVideo, isConfusedRecommendation, PREDICTION_INTERVAL_MS, recommendationAllowed, startRecommendationCooldown, learningContext, videoTimestamp } from "../utils/rollingConfusion.js";
import { useAuth } from "./useAuth.js";
import { isCurrentSession, sessionFetch } from "../utils/authClient.js";

import { createExposureTracker } from "../utils/videoExposure.js";

const recentVisits = new Map();
const predictionRequests = new Map();
const emptySignal = { maximumVideoProgressPercent: 0, activeTimeSeconds: 0, pauseCount: 0, replayCount: 0, visitCount: 0, lessonCompleted: false, confusionFeedback: null };
const emptyPending = () => ({ maximumVideoProgressPercent: 0, activeTimeSecondsDelta: 0, pauseCountDelta: 0, replayCountDelta: 0, visitCountDelta: 0 });

export function useLearningSignal({ courseId, lessonId }) {
  const { user, version } = useAuth();
  const studentId = user?.role === "student" ? user.id : "";
  const currentKey = studentId && courseId && lessonId ? `${version}:${studentId}:${courseId}:${lessonId}` : "";
  const [signal, setSignal] = useState(emptySignal);
  const [signalKey, setSignalKey] = useState("");
  const [feedbackState, setFeedbackState] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [predictionState, setPredictionState] = useState("idle");
  const [recommendation, setRecommendation] = useState(null);
  const [viewKey, setViewKey] = useState(currentKey);
  // Discard transient UI on navigation, including a return to a previously viewed lesson.
  if (viewKey !== currentKey) {
    setViewKey(currentKey);
    setRecommendation(null);
    setPredictionState("idle");
    setFeedbackState("");
    setTrackingError("");
  }
  const target = useRef(null);

  const isActive = useCallback((session) => target.current === session && !session.closed && isCurrentSession(session.version), []);

  const flushExposure = useCallback(async (session, { keepalive = false } = {}) => {
    if (!session || !isCurrentSession(session.version) || session.exposureWriting || Date.now() < (session.exposureRetryAt || 0)) return;
    const watchedRanges = session.exposure.takeBatch();
    if (!watchedRanges.length) return;
    session.exposureWriting = true;
    try {
      const response = await sessionFetch(`${API_ROOT}/learning-signals/${session.courseId}/${session.lessonId}/exposure`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ watchedRanges }), keepalive }, session.version);
      if (!response.ok) throw new Error("Exposure save failed");
    } catch {
      session.exposure.restore(watchedRanges);
      session.exposureRetryAt = Date.now() + LEARNING_SIGNAL_FLUSH_MS;
    } finally { session.exposureWriting = false; }
  }, []);

  // Serialize writes for each lesson. A prediction waits for all preceding writes;
  // a failed save retains its batch and prevents predicting against stale signals.
  const flushTarget = useCallback((session, { keepalive = false } = {}) => {
    if (!session || !isCurrentSession(session.version)) return Promise.resolve(false);
    void flushExposure(session, { keepalive });
    const write = async () => {
      if (!isCurrentSession(session.version)) return false;
      const body = pendingSignalBody(session.pending);
      if (!Object.keys(body).length) return true;
      const update = session.pending;
      session.pending = { maximumVideoProgressPercent: 0, activeTimeSecondsDelta: Math.max(0, update.activeTimeSecondsDelta - (body.activeTimeSecondsDelta || 0)), pauseCountDelta: Math.max(0, update.pauseCountDelta - (body.pauseCountDelta || 0)), replayCountDelta: Math.max(0, update.replayCountDelta - (body.replayCountDelta || 0)), visitCountDelta: Math.max(0, update.visitCountDelta - (body.visitCountDelta || 0)) };
      try {
        const response = await sessionFetch(`${API_ROOT}/learning-signals/${session.courseId}/${session.lessonId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive }, session.version);
        if (!response.ok) throw new Error("Learning activity could not be saved.");
        window.dispatchEvent(new Event("edunova-learning-updated"));
        await response.json();
        if (isActive(session)) setTrackingError("");
        return true;
      } catch (error) {
        session.pending.maximumVideoProgressPercent = Math.max(session.pending.maximumVideoProgressPercent, body.maximumVideoProgressPercent || 0);
        for (const field of ["activeTimeSecondsDelta", "pauseCountDelta", "replayCountDelta", "visitCountDelta"]) session.pending[field] += body[field] || 0;
        if (isActive(session)) setTrackingError(error.message);
        return false;
      }
    };
    session.write = (session.write || Promise.resolve()).then(write);
    return session.write;
  }, [isActive, flushExposure]);
  const flush = useCallback((options) => flushTarget(target.current, options), [flushTarget]);

  const predictTarget = useCallback(async (session, { rolling = false } = {}) => {
    if (!session || !isCurrentSession(session.version) || session.activity <= session.predictedActivity || predictionRequests.has(session.key)) return false;
    const now = Date.now();
    if (rolling && !canCheckVideo({ media: session.media, visibility: document.visibilityState, lastMovementAt: session.lastMovementAt, now, changed: session.videoActivity > session.predictedVideoActivity, lastAttemptAt: session.lastAttemptAt })) return false;
    // Capture the media position and activity belonging to this request, never a later lesson.
    let timestamp = videoTimestamp(session.media);
    const activity = session.activity;
    const videoActivity = session.videoActivity;
    session.lastAttemptAt = now;
    const pendingRequest = (async () => {
      if (isActive(session)) setPredictionState("loading");
      try {
        if (!await flushTarget(session)) throw new Error("Learning activity could not be saved.");
        if (!isCurrentSession(session.version)) return false;
        if (rolling) {
          // A slow activity save may finish after playback or navigation changed.
          if (!isActive(session) || !canCheckVideo({ media: session.media, visibility: document.visibilityState, lastMovementAt: session.lastMovementAt, now: Date.now(), changed: true, lastAttemptAt: -Infinity })) {
            if (isActive(session)) setPredictionState("idle");
            return false;
          }
          timestamp = videoTimestamp(session.media);
        }
        // Only the timestamp is supplied; the server derives identity, topics and RF inputs.
        const options = { method: "POST" };
        if (timestamp !== null) { options.headers = { "Content-Type": "application/json" }; options.body = JSON.stringify({ videoTimestampSeconds: timestamp }); }
        const response = await sessionFetch(`${API_ROOT}/learning-signals/${session.courseId}/${session.lessonId}/prediction`, options, session.version);
        if (!response.ok) throw new Error("Confusion prediction could not be generated.");
        const prediction = await response.json();
        session.predictedActivity = activity;
        session.predictedVideoActivity = videoActivity;
        session.hasNewPrediction = true;
        if (isActive(session)) {
          setSignal((current) => ({ ...current, aiPrediction: prediction })); setSignalKey(session.key); setPredictionState("success"); setTrackingError("");
          if (rolling && document.visibilityState === "visible" && !session.media?.paused && !session.media?.ended && timestamp !== null && isConfusedRecommendation(prediction) && !session.recommendationOpen && recommendationAllowed(session.cooldownKey)) {
            session.recommendationOpen = true;
            setRecommendation({ key: session.key, courseId: session.courseId, lessonId: session.lessonId, videoTimestampSeconds: timestamp });
          }
        }
        return true;
      } catch (error) {
        if (isActive(session)) { setPredictionState("error"); setTrackingError(error.message); }
        return false;
      } finally { predictionRequests.delete(session.key); }
    })();
    predictionRequests.set(session.key, pendingRequest);
    return pendingRequest;
  }, [flushTarget, isActive]);
  const requestPrediction = useCallback(() => target.current?.key === currentKey ? predictTarget(target.current) : Promise.resolve(false), [currentKey, predictTarget]);
  const dismissRecommendation = useCallback(() => {
    const session = target.current;
    if (session) { startRecommendationCooldown(session.cooldownKey); session.recommendationOpen = false; }
    setRecommendation(null);
  }, []);
  const takeRecommendationContext = useCallback(() => {
    const session = target.current;
    if (!session || !isActive(session)) return null;
    const context = learningContext(session.courseId, session.lessonId, session.media);
    dismissRecommendation();
    return context;
  }, [dismissRecommendation, isActive]);

  useEffect(() => {
    if (!studentId || !courseId || !lessonId) return undefined;
    const key = `${version}:${studentId}:${courseId}:${lessonId}`;
    const visitKey = key;
    const session = { courseId, lessonId, key, version, cooldownKey: `${studentId}:${courseId}:${lessonId}`, exposure: createExposureTracker(), pending: emptyPending(), activity: 0, predictedActivity: 0, videoActivity: 0, predictedVideoActivity: 0, lastPlaybackTime: 0, lastMovementAt: -Infinity, lastAttemptAt: Date.now(), playing: false, mediaIntentAt: 0, media: null, closed: false };
    target.current = session;
    const now = Date.now();
    if (now - (recentVisits.get(visitKey) || 0) > STRICT_MODE_VISIT_WINDOW_MS) { session.pending.visitCountDelta = 1; session.activity++; recentVisits.set(visitKey, now); }
    const controller = new AbortController();
    sessionFetch(`${API_ROOT}/learning-signals/${courseId}/${lessonId}`, { signal: controller.signal }, version)
      .then((response) => { if (!response.ok) throw new Error("Learning activity could not be restored."); return response.json(); })
      .then((saved) => { if (isActive(session)) { if (!session.hasNewPrediction) setSignal(saved); setSignalKey(key); setFeedbackState(""); setTrackingError(""); } })
      .catch((error) => { if (error.name !== "AbortError" && isActive(session)) setTrackingError(error.message); });
    const activeTimer = window.setInterval(() => { if (session.playing && shouldCountActiveTime(document.visibilityState)) { session.pending.activeTimeSecondsDelta += 1; session.activity++; } }, 1000);
    const flushTimer = window.setInterval(() => flushTarget(session), LEARNING_SIGNAL_FLUSH_MS);
    const predictionTimer = window.setInterval(() => { void predictTarget(session, { rolling: true }); }, PREDICTION_INTERVAL_MS);
    const visibility = () => { session.exposure.reset(); if (document.visibilityState === "hidden") flushTarget(session, { keepalive: true }); };
    const pageExit = () => { session.exposure.reset(); flushTarget(session, { keepalive: true }); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageExit);
    return () => {
      controller.abort(); session.closed = true;
      window.clearInterval(activeTimer); window.clearInterval(flushTimer); window.clearInterval(predictionTimer);
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pageExit);
      // Bind exit work to the old lesson, even if a new lesson mounts before I/O finishes.
      void flushTarget(session, { keepalive: true });
      void predictTarget(session);
    };
  }, [courseId, lessonId, studentId, version, flushTarget, predictTarget, isActive]);

  const recordMaximumProgress = (session, media) => {
    if (!Number.isFinite(media.duration) || media.duration <= 0) return;
    session.pending.maximumVideoProgressPercent = maximumWatchedPercent(session.pending.maximumVideoProgressPercent, media.currentTime, media.duration);
  };
  const mediaHandlers = {
    onLoadedMetadata(event) { const session = target.current; if (!session) return; session.exposure.reset(); session.media = event.currentTarget; session.lastPlaybackTime = event.currentTarget.currentTime || 0; recordMaximumProgress(session, event.currentTarget); },
    onPlay(event) { const session = target.current; if (!session) return; session.playing = !event.currentTarget.paused; session.media = event.currentTarget; session.exposure.reset(); session.exposure.sample(event.currentTarget, document.visibilityState === "visible"); },
    onPlaying(event) { const session = target.current; if (!session) return; session.playing = !event.currentTarget.paused; session.media = event.currentTarget; session.exposure.reset(); session.exposure.sample(event.currentTarget, document.visibilityState === "visible"); },
    onWaiting() { const session = target.current; if (!session) return; session.playing = false; session.exposure.reset(); },
    onStalled() { const session = target.current; if (!session) return; session.playing = false; session.exposure.reset(); },
    onPointerDown() { if (target.current) target.current.mediaIntentAt = Date.now(); },
    onKeyDown(event) { if (target.current && [" ", "k", "K"].includes(event.key)) target.current.mediaIntentAt = Date.now(); },
    onTimeUpdate(event) {
      const session = target.current; if (!session) return;
      const media = event.currentTarget; session.media = media;
      session.exposure.sample(media, document.visibilityState === "visible");
      recordMaximumProgress(session, media);
      if (media.tagName === "VIDEO" && !media.paused && !media.seeking && document.visibilityState === "visible" && Math.abs(media.currentTime - session.lastPlaybackTime) >= 0.1) { session.videoActivity++; session.activity++; session.lastMovementAt = Date.now(); }
      session.lastPlaybackTime = media.currentTime;
    },
    onSeeking(event) { const session = target.current; if (!session) return; session.exposure.reset(); const next = event.currentTarget.currentTime; if (isBackwardReplay(session.lastPlaybackTime, next)) { session.pending.replayCountDelta++; session.activity++; session.videoActivity++; } session.lastPlaybackTime = next; },
    onSeeked(event) { const session = target.current; if (!session) return; session.exposure.reset(); session.exposure.sample(event.currentTarget, document.visibilityState === "visible"); },
    onRateChange() { target.current?.exposure.reset(); },
    onPause(event) { const session = target.current; if (!session) return; session.exposure.sample(event.currentTarget, document.visibilityState === "visible", undefined, true); if (isStudentPause({ wasPlaying: session.playing, intentAt: session.mediaIntentAt, ended: event.currentTarget.ended })) { session.pending.pauseCountDelta++; session.activity++; session.videoActivity++; } session.playing = false; session.mediaIntentAt = 0; void flushTarget(session); },
    onEnded() { const session = target.current; if (!session) return; session.exposure.sample(session.media, document.visibilityState === "visible", undefined, true); session.playing = false; session.pending.maximumVideoProgressPercent = 100; session.activity++; void flushTarget(session); },
  };
  const saveFeedback = useCallback(async (feedback) => {
    const session = target.current;
    if (!session || session.feedbackSaving || !isActive(session)) return;
    session.feedbackSaving = true;
    setFeedbackState("saving"); setTrackingError("");
    try {
      const response = await sessionFetch(`${API_ROOT}/learning-signals/${session.courseId}/${session.lessonId}/feedback`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback }) }, session.version);
      if (!response.ok) throw new Error("Feedback could not be saved.");
      const saved = await response.json(); session.activity++;
      if (isActive(session)) { setSignal(saved); setSignalKey(session.key); setFeedbackState("saved"); }
      await predictTarget(session);
    } catch (error) { if (isActive(session)) { setFeedbackState("error"); setTrackingError(error.message); } }
    finally { session.feedbackSaving = false; }
  }, [isActive, predictTarget]);
  return { signal: signalKey === currentKey ? signal : emptySignal, feedbackState, trackingError, predictionState, saveFeedback, requestPrediction, flush, mediaHandlers, recommendation: recommendation?.key === currentKey ? recommendation : null, dismissRecommendation, takeRecommendationContext };
}

import { useEffect, useRef, useState } from "react";
import { API_ROOT } from "../utils/courseApi.js";

export function useLessonWatch({ courseSlug, lessonIndex, enabled, onCompleted }) {
  const [loadedKey, setLoadedKey] = useState("");
  const [notice, setNotice] = useState({ key: "", message: "" });
  const key = `${courseSlug}:${lessonIndex}:${enabled}`;
  const ready = !enabled || loadedKey === key;
  const status = notice.key === key ? notice.message : "";
  const setStatus = (message) => setNotice({ key: target.current, message });
  const progress = useRef({ furthestWatchedPosition: 0, lastPosition: 0 });
  const localFurthest = useRef(0);
  const media = useRef(null);
  const requestQueue = useRef(Promise.resolve());
  const lastReportAt = useRef(0);
  const completionCheckpointSent = useRef(false);
  const target = useRef("");

  useEffect(() => {
    target.current = key;
    progress.current = { furthestWatchedPosition: 0, lastPosition: 0 };
    localFurthest.current = 0;
    media.current = null;
    requestQueue.current = Promise.resolve();
    lastReportAt.current = 0;
    completionCheckpointSent.current = false;
    if (!enabled) return undefined;
    const controller = new AbortController();
    const token = localStorage.getItem("token");
    fetch(`${API_ROOT}/enrollments/${encodeURIComponent(courseSlug)}/lessons/${lessonIndex}/watch`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Watch progress is unavailable")))
      .then((saved) => {
        if (target.current !== key) return;
        progress.current = saved;
        localFurthest.current = saved.furthestWatchedPosition || 0;
        const player = media.current;
        if (player && Number.isFinite(player.duration)) player.currentTime = Math.min(saved.lastPosition || 0, saved.furthestWatchedPosition || 0, Math.max(0, player.duration - 0.5));
        setLoadedKey(key);
      })
      .catch((error) => { if (error.name !== "AbortError" && target.current === key) setStatus(error.message); });
    return () => controller.abort();
  }, [courseSlug, lessonIndex, enabled, key]);

  const report = (event, player, positionOverride) => {
    if (!enabled) return Promise.resolve(true);
    const key = target.current;
    if (!ready || !Number.isFinite(player.duration) || player.duration <= 0) return Promise.resolve(false);
    const position = positionOverride ?? player.currentTime;
    const duration = player.duration;
    const task = requestQueue.current.catch(() => {}).then(async () => {
      const response = await fetch(`${API_ROOT}/enrollments/${encodeURIComponent(courseSlug)}/lessons/${lessonIndex}/watch`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ event, position, duration }),
      });
      const saved = await response.json();
      if (target.current !== key) return false;
      if (!response.ok) {
        player.pause();
        progress.current = saved.progress || progress.current;
        localFurthest.current = progress.current.furthestWatchedPosition || 0;
        completionCheckpointSent.current = false;
        player.currentTime = Math.min(player.currentTime, progress.current.furthestWatchedPosition || 0);
        setStatus(saved.message || "Watch progress could not be saved");
        return false;
      }
      progress.current = saved;
      localFurthest.current = Math.max(localFurthest.current, saved.furthestWatchedPosition || 0);
      if (saved.enrollment) onCompleted?.(saved.enrollment);
      setStatus("");
      return true;
    }).catch(() => {
      if (target.current === key) { player.pause(); completionCheckpointSent.current = false; setStatus("Connection lost. Reload to restore watch progress."); }
      return false;
    });
    requestQueue.current = task;
    return task;
  };

  const mediaHandlers = {
    onLoadedMetadata(event) {
      media.current = event.currentTarget;
      if (enabled && !ready) event.currentTarget.pause();
      else if (enabled && Number.isFinite(event.currentTarget.duration)) {
        event.currentTarget.currentTime = Math.min(progress.current.lastPosition || 0, progress.current.furthestWatchedPosition || 0, Math.max(0, event.currentTarget.duration - 0.5));
      }
    },
    onPlay(event) { if (enabled && !ready) { event.currentTarget.pause(); return; } void report("play", event.currentTarget); },
    onTimeUpdate(event) {
      if (!enabled || !ready || event.currentTarget.paused) return;
      if (!event.currentTarget.seeking) localFurthest.current = Math.max(localFurthest.current, event.currentTarget.currentTime);
      const completionCheckpoint = !completionCheckpointSent.current && event.currentTarget.currentTime >= event.currentTarget.duration * 0.95;
      if (completionCheckpoint || Date.now() - lastReportAt.current >= 4000) {
        if (completionCheckpoint) completionCheckpointSent.current = true;
        lastReportAt.current = Date.now();
        void report("heartbeat", event.currentTarget);
      }
    },
    onSeeking(event) {
      if (!enabled) return;
      const player = event.currentTarget;
      const savedLimit = progress.current.furthestWatchedPosition || 0;
      const limit = ready ? Math.max(savedLimit, localFurthest.current) : 0;
      if (player.currentTime > limit + 0.01) { player.currentTime = limit; setStatus("Watch this part before skipping ahead."); return; }
      if (ready) {
        if (player.currentTime > savedLimit + 0.01) void report("heartbeat", player, localFurthest.current);
        void report("seek", player);
      }
    },
    onSeeked(event) { if (enabled && ready && !event.currentTarget.paused) void report("play", event.currentTarget); },
    onPause(event) { if (enabled && ready && !event.currentTarget.ended) void report("pause", event.currentTarget); },
    onEnded(event) { return report("ended", event.currentTarget); },
  };

  return { ready, status, mediaHandlers };
}

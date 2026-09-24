import { formatMediaDuration } from "./mediaDuration.js";

export function validLessonDuration(value) {
  const parts = String(value || "").split(":");
  if (parts.length < 2 || parts.length > 3 || !parts.every(part => /^\d+$/.test(part))) return false;
  if (parts.slice(1).some(part => part.length !== 2 || Number(part) >= 60)) return false;
  const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86400;
}

export function captureLessonMetadata(event, { lessonId, savedDuration, isCurrent, setDraft }) {
  // React clears currentTarget after the handler returns. Never retain the event
  // in a state updater: that updater can execute later or be replayed by React.
  const element = event.currentTarget;
  const seconds = element?.duration;
  if (!lessonId || validLessonDuration(savedDuration) || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) return;
  const duration = formatMediaDuration(seconds);
  setDraft(current => {
    if (!isCurrent() || String(current.lessonId) !== String(lessonId) || current.mainVideo || validLessonDuration(current.duration)) return current;
    return { ...current, duration };
  });
}

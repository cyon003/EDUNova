export const LEARNING_SIGNAL_FLUSH_MS = 25000;
export const STRICT_MODE_VISIT_WINDOW_MS = 2000;

export function maximumWatchedPercent(currentMaximum, currentTime, duration) {
  if (![currentMaximum, currentTime, duration].every(Number.isFinite) || duration <= 0) return currentMaximum;
  return Math.max(currentMaximum, Math.min(100, Math.max(0, currentTime / duration * 100)));
}

export function isBackwardReplay(previousTime, nextTime) {
  return Number.isFinite(previousTime) && Number.isFinite(nextTime) && previousTime - nextTime >= 10;
}

export function isStudentPause({ wasPlaying, intentAt, now = Date.now(), ended }) {
  return Boolean(wasPlaying && !ended && Number.isFinite(intentAt) && now - intentAt >= 0 && now - intentAt < 1500);
}

export function shouldCountActiveTime(visibilityState) {
  return visibilityState === "visible";
}

export function pendingSignalBody(update) {
  const body = {};
  if (update.maximumVideoProgressPercent > 0) body.maximumVideoProgressPercent = update.maximumVideoProgressPercent;
  const caps = { activeTimeSecondsDelta: 300, pauseCountDelta: 100, replayCountDelta: 100, visitCountDelta: 1 };
  for (const [field, cap] of Object.entries(caps)) if (update[field] > 0) body[field] = Math.min(update[field], cap);
  return body;
}

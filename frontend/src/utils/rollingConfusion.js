// These controls affect request/prompt frequency, never the model's six features.
export const PREDICTION_INTERVAL_MS = 60_000;
export const RECOMMENDATION_COOLDOWN_MS = 5 * 60_000;

export function videoTimestamp(media) {
  if (media?.tagName !== "VIDEO" || !Number.isFinite(media.currentTime)) return null;
  const timestamp = Math.max(0, media.currentTime);
  return Number.isFinite(media.duration) && media.duration > 0 ? Math.min(media.duration, timestamp) : timestamp;
}

export function canCheckVideo({ media, visibility, lastMovementAt, now, changed, lastAttemptAt }) {
  return visibility === "visible" && videoTimestamp(media) !== null && !media.paused && !media.ended && !media.seeking
    && now - lastMovementAt <= 5000 && changed && now - lastAttemptAt >= PREDICTION_INTERVAL_MS;
}

export function isConfusedRecommendation(prediction) {
  return prediction?.prediction === "confused";
}

// This is a UX preference, scoped to student + course + lesson, not trusted auth state.
const cooldowns = new Map();
const storageKey = (key) => `edunova:confusion-recommendation:${key}`;
export function recommendationAllowed(key, now = Date.now()) {
  let until = cooldowns.get(key) || 0;
  try {
    const saved = Number(sessionStorage.getItem(storageKey(key)));
    if (Number.isFinite(saved)) until = Math.max(until, saved);
  } catch { /* Private mode/storage restrictions: retain the in-memory fallback. */ }
  return until <= now;
}
export function startRecommendationCooldown(key, now = Date.now()) {
  const until = now + RECOMMENDATION_COOLDOWN_MS;
  cooldowns.set(key, until);
  try { sessionStorage.setItem(storageKey(key), String(until)); } catch { /* Optional UX persistence. */ }
}

export function learningContext(courseId, lessonId, media) {
  const videoTimestampSeconds = videoTimestamp(media);
  return videoTimestampSeconds === null ? null : { courseId, lessonId, videoTimestampSeconds };
}

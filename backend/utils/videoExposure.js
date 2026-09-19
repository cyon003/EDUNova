const SUFFICIENT_EXPOSURE_RATIO = 0.5;
const MAX_REQUEST_RANGES = 32;
const MAX_RANGE_SECONDS = 30;
const MAX_BATCH_SECONDS = 120;
const MAX_VIDEO_SECONDS = 86400;
const MAX_STORED_RANGES = 2048;
const precision = value => Math.round(value * 1000) / 1000;
function validateRanges(body, duration = null) {
  if (!body || Array.isArray(body) || Object.keys(body).some(key => key !== "watchedRanges") || !Array.isArray(body.watchedRanges) || !body.watchedRanges.length || body.watchedRanges.length > MAX_REQUEST_RANGES) return "Provide 1–32 watched ranges only";
  let total = 0;
  for (const range of body.watchedRanges) {
    if (!range || Object.keys(range).some(key => !["startTimeSeconds", "endTimeSeconds"].includes(key))) return "Unsupported range field";
    const { startTimeSeconds: start, endTimeSeconds: end } = range;
    if (![start, end].every(Number.isFinite) || start < 0 || end <= start || end > MAX_VIDEO_SECONDS || precision(end - start) > MAX_RANGE_SECONDS || (Number.isFinite(duration) && duration > 0 && end > duration)) return "Invalid or excessive watched range";
    total += end - start;
  }
  return precision(total) > MAX_BATCH_SECONDS ? "Watched batch exceeds 120 seconds" : null;
}
function inward(value, start) {
  const scaled = value * 1000;
  // Remove binary representation noise without rounding up real sub-ms coverage.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Math.max(0, (start ? Math.ceil(scaled - tolerance) : Math.floor(scaled + tolerance)) / 1000);
}
function mergeRanges(ranges) {
  const sorted = ranges.map(r => ({ startTimeSeconds: inward(r.startTimeSeconds, true), endTimeSeconds: inward(r.endTimeSeconds, false) })).filter(r => r.endTimeSeconds > r.startTimeSeconds).sort((a,b) => a.startTimeSeconds - b.startTimeSeconds);
  const merged = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.startTimeSeconds <= last.endTimeSeconds) last.endTimeSeconds = Math.max(last.endTimeSeconds, range.endTimeSeconds);
    else merged.push(range);
  }
  return merged;
}
const uniqueSeconds = ranges => precision(mergeRanges(ranges).reduce((sum,r) => sum + r.endTimeSeconds-r.startTimeSeconds,0));
function sufficientlyExposed(ranges, topic) {
  const duration = topic.endTimeSeconds-topic.startTimeSeconds;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  const covered = precision(mergeRanges(ranges).reduce((sum,r) => sum + Math.max(0, Math.min(r.endTimeSeconds,topic.endTimeSeconds)-Math.max(r.startTimeSeconds,topic.startTimeSeconds)),0));
  return covered >= duration * SUFFICIENT_EXPOSURE_RATIO;
}
module.exports = { SUFFICIENT_EXPOSURE_RATIO, MAX_STORED_RANGES, validateRanges, mergeRanges, uniqueSeconds, sufficientlyExposed };

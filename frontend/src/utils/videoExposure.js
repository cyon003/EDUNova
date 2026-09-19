// Coverage is media seconds, at supported playback rates 0.25x–4x.
// Gaps over two wall-clock seconds are discarded conservatively.
export function mergeWatchedRanges(ranges) {
  const result = [];
  for (const range of [...ranges].sort((a,b) => a.startTimeSeconds-b.startTimeSeconds)) {
    const last = result.at(-1);
    if (last && range.startTimeSeconds <= last.endTimeSeconds) last.endTimeSeconds = Math.max(last.endTimeSeconds,range.endTimeSeconds);
    else result.push({ ...range });
  }
  return result;
}
export function createExposureTracker(clock = () => performance.now()) {
  let previous = null;
  let pending = [];
  return {
    reset() { previous = null; },
    sample(media, visible, now = clock(), finishing = false) {
      const rate = media?.playbackRate ?? 1;
      const valid = media?.tagName === 'VIDEO' && visible && !media.seeking && Number.isFinite(media.currentTime) && media.currentTime >= 0 && media.currentTime <= 86400 && rate >= 0.25 && rate <= 4;
      if (!valid || ((!finishing) && (media.paused || media.ended))) { previous = null; return; }
      const position = Number.isFinite(media.duration) && media.duration > 0 ? Math.min(media.currentTime,media.duration) : media.currentTime;
      if (previous && previous.rate === rate) {
        const elapsed = (now-previous.now)/1000;
        const delta = position-previous.position;
        if (elapsed > 0 && elapsed <= 2 && delta > 0 && delta <= elapsed*rate + 0.25) {
          // Millisecond precision; round inward so quantization cannot add coverage.
          const startTimeSeconds = Math.ceil(previous.position*1000)/1000;
          const endTimeSeconds = Math.floor(position*1000)/1000;
          if (endTimeSeconds > startTimeSeconds) pending = mergeWatchedRanges([...pending,{startTimeSeconds,endTimeSeconds}]).slice(0,2048);
        }
      }
      previous = finishing ? null : { position, rate, now };
    },
    takeBatch() {
      const batch = []; let budget = 120;
      while (pending.length && batch.length < 32 && budget > 0) {
        const range = pending[0];
        const end = Math.min(range.endTimeSeconds, range.startTimeSeconds+30, range.startTimeSeconds+budget);
        batch.push({ startTimeSeconds: range.startTimeSeconds, endTimeSeconds: end });
        budget -= end-range.startTimeSeconds;
        if (end >= range.endTimeSeconds) pending.shift(); else range.startTimeSeconds = end;
      }
      return batch;
    },
    restore(ranges) { pending = mergeWatchedRanges([...ranges,...pending]).slice(0,2048); },
  };
}

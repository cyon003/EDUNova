const MAX_DURATION_SECONDS = 24 * 60 * 60;
const MAX_REPORT_GAP_SECONDS = 15;
const MAX_PLAYBACK_RATE = 2;
const CLOCK_SLACK_SECONDS = 0.75;
const COMPLETION_PERCENTAGE = 95;
const MEDIA_EXTENSION = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|m4a|ogg)$/i;

function lessonMediaKey(lesson) {
  const media = lesson?.primaryMedia;
  if (media?.storedName) return String(media.storedName);
  if (!lesson?.primaryMediaRemoved) {
    const legacy = (lesson?.resources || []).find((resource) => /^(video|audio)\//i.test(String(resource.mimeType || "")) || MEDIA_EXTENSION.test(String(resource.originalName || "")));
    if (legacy) return String(legacy.storedName || legacy._id);
    if (String(lesson?.videoUrl || "").includes("/uploads/course-videos/")) return String(lesson.videoUrl);
  }
  return "";
}

function statedDurationSeconds(value) {
  const match = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(String(value || "").trim());
  if (!match || Number(match[2]) >= 60 || (match[3] && Number(match[3]) >= 60)) return 0;
  return match[3] ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : Number(match[1]) * 60 + Number(match[2]);
}

function watchState(previous, mediaKey) {
  if (!previous || previous.mediaKey !== mediaKey) return {
    mediaKey, furthestWatchedPosition: 0, lastPosition: 0, videoDuration: 0,
    observedPlaybackSeconds: 0, isPlaying: false, playSegmentStartedAt: null,
    playSegmentStartPosition: 0, lastReportAt: null, revision: previous?.revision || 0,
    completionRecordedAt: null,
  };
  return previous;
}

function advanceWatch(previous, input, now, mediaKey, lessonDuration) {
  const state = watchState(previous, mediaKey);
  const { event, position, duration } = input;
  if (!["play", "heartbeat", "seek", "pause", "ended"].includes(event) ||
      !Number.isFinite(position) || position < 0 ||
      !Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS ||
      position > duration + CLOCK_SLACK_SECONDS) {
    return { error: "Invalid watch update" };
  }
  const stated = statedDurationSeconds(lessonDuration);
  if (stated && Math.abs(duration - stated) > 2) return { error: "Video duration does not match the lesson" };
  if (state.videoDuration && Math.abs(duration - state.videoDuration) > Math.max(2, state.videoDuration * 0.01)) {
    return { error: "Video duration changed; reload the lesson" };
  }
  const rawElapsed = state.lastReportAt ? Math.max(0, (now - new Date(state.lastReportAt)) / 1000) : 0;
  const elapsed = Math.min(rawElapsed, MAX_REPORT_GAP_SECONDS);
  const segmentElapsed = state.playSegmentStartedAt ? Math.max(0, (now - new Date(state.playSegmentStartedAt)) / 1000) : 0;
  const reachable = Math.min(duration, (state.playSegmentStartPosition || 0) + segmentElapsed * MAX_PLAYBACK_RATE + CLOCK_SLACK_SECONDS);
  const alreadyWatched = position <= state.furthestWatchedPosition + 0.01;
  if (event === "seek" || event === "play") {
    if (!alreadyWatched) return { error: "Cannot seek past watched content" };
  } else if (event === "pause" && !state.isPlaying && alreadyWatched) {
    // A browser may pause immediately after an allowed seek.
  } else if (!state.isPlaying || rawElapsed > MAX_REPORT_GAP_SECONDS || (!alreadyWatched && position > reachable)) {
    return { error: "Cannot skip unwatched content" };
  }
  const newlyWatched = Math.max(0, position - Math.max(state.lastPosition, state.furthestWatchedPosition));
  return {
    mediaKey,
    furthestWatchedPosition: event === "seek" || event === "play" || (event === "pause" && !state.isPlaying) ? state.furthestWatchedPosition : Math.max(state.furthestWatchedPosition, Math.min(position, duration)),
    lastPosition: Math.min(position, duration),
    videoDuration: state.videoDuration || duration,
    observedPlaybackSeconds: state.observedPlaybackSeconds + Math.min(newlyWatched, elapsed * MAX_PLAYBACK_RATE),
    isPlaying: event === "play" || event === "heartbeat",
    playSegmentStartedAt: event === "play" ? now : state.playSegmentStartedAt,
    playSegmentStartPosition: event === "play" ? position : state.playSegmentStartPosition,
    lastReportAt: now,
    completionRecordedAt: state.completionRecordedAt || null,
  };
}

function canCompleteWatchedMedia(watch, mediaKey, lessonDuration) {
  const trustedDuration = statedDurationSeconds(lessonDuration);
  const requiredPosition = watch?.videoDuration * COMPLETION_PERCENTAGE / 100;
  return Boolean(watch && watch.mediaKey === mediaKey && trustedDuration > 0 &&
    Math.abs(watch.videoDuration - trustedDuration) <= 2 &&
    watch.furthestWatchedPosition >= requiredPosition - 0.01 &&
    watch.observedPlaybackSeconds >= requiredPosition - 0.01);
}

module.exports = { lessonMediaKey, watchState, advanceWatch, canCompleteWatchedMedia, statedDurationSeconds, COMPLETION_PERCENTAGE };

// Navigation state is a hint only. The backend authorizes and resolves all content.
export function navigationLearningContext(state) {
  const context = state?.learningContext;
  if (!context || !['courseId', 'lessonId'].every(key => typeof context[key] === 'string' && /^[a-f\d]{24}$/i.test(context[key]))
    || !Number.isFinite(context.videoTimestampSeconds) || context.videoTimestampSeconds < 0) return null;
  return { courseId: context.courseId, lessonId: context.lessonId, videoTimestampSeconds: context.videoTimestampSeconds };
}
export function aiChatPayload(message, context) {
  return context ? { mode: 'lesson', message, courseId: context.courseId, lessonId: context.lessonId, videoTimestampSeconds: context.videoTimestampSeconds }
    : { mode: 'general', message };
}
export function aiHistoryQuery(context) {
  return new URLSearchParams(context ? { mode: 'lesson', courseId: context.courseId, lessonId: context.lessonId, videoTimestampSeconds: String(context.videoTimestampSeconds) } : { mode: 'general' }).toString();
}
export function contextDisplayMetadata(context) {
  if (!context || typeof context.courseTitle !== 'string' || typeof context.lessonTitle !== 'string' || !Number.isFinite(context.videoTimestampSeconds) || context.videoTimestampSeconds < 0) return null;
  return { courseTitle: context.courseTitle.slice(0, 200), lessonTitle: context.lessonTitle.slice(0, 200), topicTitle: typeof context.topicTitle === 'string' ? context.topicTitle.slice(0, 200) : null, videoTimestampSeconds: context.videoTimestampSeconds };
}
export function videoPositionLabel(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

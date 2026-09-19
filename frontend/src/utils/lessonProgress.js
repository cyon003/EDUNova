export function nextIncompleteLessonIndex(lessonCount, completedLessons = [], currentLessonIndex = 0) {
  if (!Number.isInteger(lessonCount) || lessonCount <= 0) return 0;
  const current = Number.isInteger(currentLessonIndex) && currentLessonIndex >= 0 && currentLessonIndex < lessonCount
    ? currentLessonIndex : 0;
  const completed = new Set(completedLessons);
  for (let offset = 0; offset < lessonCount; offset += 1) {
    const index = (current + offset) % lessonCount;
    if (!completed.has(index)) return index;
  }
  return current;
}

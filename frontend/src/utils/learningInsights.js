export const topicHasSample = topic => topic?.sampleSufficient === true && topic.observedStudents >= 5 && Number.isFinite(topic.confusionRate);
export const analyticsBand = rate => !Number.isFinite(rate) ? 'collecting' : rate < 40 ? 'low' : rate < 70 ? 'medium' : 'high';
// Use the already authenticated tutor course response when an older analytics
// server omits media metadata. Match stable IDs, never title or filtered index.
export function learningInsightCourses(analyticsCourses, ownedCourses = []) {
  return analyticsCourses.map(course => {
    const saved = ownedCourses.find(item => String(item._id) === String(course.courseId));
    if (!saved || course.courseSlug) return course;
    const rows = course.lessonCatalog || course.lessons || [];
    return { ...course, courseSlug: saved.slug, courseVersion: saved.__v || 0,
      lessonCatalog: (saved.lessons || []).map((lesson, index) => {
        const row = rows.find(item => String(item.lessonId) === String(lesson._id));
        return { ...(row || { predictionCount: 0, topics: [] }), lessonId: lesson._id, lessonTitle: lesson.title, lessonOrder: index + 1 };
      }),
    };
  });
}

function summarizeEnrollment(enrollment) {
  const data = typeof enrollment.toObject === "function" ? enrollment.toObject({ flattenMaps: true }) : { ...enrollment };
  const totalLessons = Array.isArray(data.course?.lessons) ? data.course.lessons.length : 0;
  const completedLessons = [...new Set(data.completedLessons || [])]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < totalLessons)
    .sort((first, second) => first - second);

  return {
    ...data,
    completedLessons,
    completedLessonCount: completedLessons.length,
    totalLessons,
    completionPercentage: totalLessons ? Math.round((completedLessons.length / totalLessons) * 100) : 0,
  };
}

module.exports = { summarizeEnrollment };

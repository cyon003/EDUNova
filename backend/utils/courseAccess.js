function restrictCourseContent(course) {
  const restricted = typeof course.toObject === "function" ? course.toObject() : structuredClone(course);
  restricted.lessons = (restricted.lessons || []).map((lesson) => ({
    ...lesson,
    videoUrl: "",
    resources: [],
  }));
  restricted._restricted = true;
  return restricted;
}

module.exports = { restrictCourseContent };

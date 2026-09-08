function restrictCourseContent(course) {
  const restricted = typeof course.toObject === "function" ? course.toObject() : structuredClone(course);
  restricted.lessons = (restricted.lessons || []).map((lesson, index) => {
    const restrictedLesson = { ...lesson, videoUrl: "", resources: [] };
    // Keep only enough metadata to render the free preview's player. File names
    // and storage locations stay server-side; the media route still authorizes it.
    const hasPreviewMedia = lesson.primaryMedia?.storedName || !lesson.primaryMediaRemoved && (
      String(lesson.videoUrl || "").includes("/uploads/course-videos/")
      || (lesson.resources || []).some((resource) => /^(video|audio)\//i.test(resource.mimeType || ""))
    );
    if (index === 0 && hasPreviewMedia) {
      restrictedLesson.primaryMedia = {
        originalName: lesson.primaryMedia?.originalName || "Lesson video",
        mimeType: lesson.primaryMedia?.mimeType || "video/mp4",
        size: lesson.primaryMedia?.size || 0,
      };
    } else {
      restrictedLesson.primaryMedia = undefined;
    }
    return restrictedLesson;
  });
  restricted._restricted = true;
  return restricted;
}

module.exports = { restrictCourseContent };

function restrictCourseContent(course) {
  // Preserve BSON ObjectId JSON serialization when passed an already-plain course.
  // structuredClone strips its prototype and exposes a buffer instead of the ID.
  const restricted = typeof course.toObject === "function" ? course.toObject() : JSON.parse(JSON.stringify(course));
  restricted.lessons = (restricted.lessons || []).map((lesson, index) => {
    const restrictedLesson = { ...lesson, videoUrl: "", resources: [], quiz: undefined };
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

const { sufficientlyExposed } = require("../utils/videoExposure");
const MIN_OBSERVED_STUDENTS = 5;

// validSignals retains the legacy lesson/unmapped aggregates only. Named topic
// cohorts come exclusively from sufficiently covered video exposure records.
function topicAnalytics(courses, validSignals, eventGroups, exposures = []) {
  const lessons = new Map();
  for (const course of courses) for (const lesson of course.lessons) {
    lessons.set(`${course._id}:${lesson._id}`, {
      observed: new Set(), unmapped: new Set(), historical: new Set(),
      topics: new Map((lesson.topics || []).map(topic => [String(topic._id), { topic, observed: new Set(), students: new Set(), latest: null }])),
    });
  }
  for (const signal of validSignals) {
    if (signal.student) lessons.get(`${signal.course}:${signal.lessonId}`)?.observed.add(String(signal.student));
  }
  for (const exposure of exposures) {
    const lesson = lessons.get(`${exposure.course}:${exposure.lessonId}`);
    if (!lesson || !exposure.student) continue;
    for (const bucket of lesson.topics.values()) if (sufficientlyExposed(exposure.watchedRanges || [], bucket.topic)) bucket.observed.add(String(exposure.student));
  }
  for (const group of eventGroups) {
    const { course, lessonId, topicId, student } = group._id;
    const lesson = lessons.get(`${course}:${lessonId}`);
    if (!lesson || !student) continue;
    if (topicId == null) { if (lesson.observed.has(String(student))) lesson.unmapped.add(String(student)); continue; }
    const bucket = lesson.topics.get(String(topicId));
    if (!bucket) { if (lesson.observed.has(String(student))) lesson.historical.add(String(student)); continue; }
    if (!bucket.observed.has(String(student))) continue;
    bucket.students.add(String(student));
    const time = group.latestConfusionAt ? new Date(group.latestConfusionAt) : null;
    if (time && Number.isFinite(time.getTime()) && (!bucket.latest || time > bucket.latest)) bucket.latest = time;
  }
  return new Map([...lessons].map(([key, lesson]) => {
    const observedStudents = lesson.observed.size;
    return [key, {
      observedStudents,
      unmappedConfusionStudents: lesson.unmapped.size,
      historicalConfusionStudents: lesson.historical.size,
      topics: [...lesson.topics.values()].map(({ topic, observed, students, latest }) => {
        const observedStudents = observed.size;
        const sampleSufficient = observedStudents >= MIN_OBSERVED_STUDENTS;
        return ({
        topicId: topic._id, title: topic.title, startTimeSeconds: topic.startTimeSeconds, endTimeSeconds: topic.endTimeSeconds,
        confusedStudents: students.size, observedStudents,
        confusionRate: sampleSufficient ? Math.round(students.size / observedStudents * 100) : null,
        sampleSufficient, latestConfusionAt: latest,
      }); }),
    }];
  }));
}

function topicEventPipeline(courseIds) {
  return [
    { $match: { course: { $in: courseIds }, source: "random_forest", prediction: "confused", confusionProbability: { $gte: 0, $lte: 1 }, videoTimestampSeconds: { $gte: 0 } } },
    { $group: { _id: { course: "$course", lessonId: "$lessonId", topicId: "$topicId", student: "$student" }, latestConfusionAt: { $max: "$createdAt" } } },
  ];
}
module.exports = { topicAnalytics, topicEventPipeline, MIN_OBSERVED_STUDENTS };

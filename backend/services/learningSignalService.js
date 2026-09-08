const LearningSignal = require("../models/LearningSignal");

async function synchronizeLessonCompletion(student, course, completedLessons) {
  const completed = new Set(completedLessons || []);
  const operations = course.lessons.map((lesson, index) => ({
    updateOne: {
      filter: { student, course: course._id, lessonId: lesson._id },
      update: { $set: { lessonCompleted: completed.has(index) } },
      upsert: completed.has(index),
    },
  }));
  if (operations.length) await LearningSignal.bulkWrite(operations, { ordered: false });
}

module.exports = { synchronizeLessonCompletion };

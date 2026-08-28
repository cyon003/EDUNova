const mongoose = require("mongoose");
require("dotenv").config();
const Course = require("../models/Course");
const LessonResourceChunk = require("../models/LessonResourceChunk");
const { processResourceExtraction, searchableContentType } = require("../services/lessonResourceExtraction");

async function reprocessLessonResources() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  await mongoose.connect(process.env.MONGO_URI);
  await LessonResourceChunk.syncIndexes();
  const courses = await Course.find({ "lessons.resources.0": { $exists: true } });
  let processed = 0, completed = 0, failed = 0;
  for (const course of courses) {
    for (const lesson of course.lessons) {
      for (const resource of lesson.resources) {
        if (!searchableContentType(resource)) continue;
        processed += 1;
        const result = await processResourceExtraction({ courseId: course._id, lessonId: lesson._id, resourceId: resource._id });
        if (result.status === "completed") completed += 1; else failed += 1;
      }
    }
  }
  return { processed, completed, failed };
}

if (require.main === module) {
  reprocessLessonResources()
    .then((result) => console.log(`Resource extraction complete: ${result.completed}/${result.processed} completed, ${result.failed} failed.`))
    .catch((error) => { console.error(`Resource extraction could not run: ${error.message}`); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}

module.exports = { reprocessLessonResources };

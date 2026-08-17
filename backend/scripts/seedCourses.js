const mongoose = require("mongoose");
require("dotenv").config();

const Course = require("../models/Course");

const courses = [
  {
    slug: "mathematics",
    name: "Mathematics",
    rating: 4.8,
    level: "All levels",
    duration: "12 weeks",
    description: "Study algebra, geometry, statistics, and problem-solving.",
  },
  {
    slug: "science",
    name: "Science",
    rating: 4.7,
    level: "All levels",
    duration: "14 weeks",
    description: "Explore biology, chemistry, physics, and the natural world.",
  },
  {
    slug: "english",
    name: "English",
    rating: 4.9,
    level: "All levels",
    duration: "10 weeks",
    description: "Develop reading, writing, grammar, and communication skills.",
  },
  {
    slug: "social-studies",
    name: "Social Studies",
    rating: 4.6,
    level: "All levels",
    duration: "12 weeks",
    description: "Learn about society, government, history, and global cultures.",
  },
  {
    slug: "physical-education",
    name: "Physical Education",
    rating: 4.8,
    level: "All levels",
    duration: "8 weeks",
    description: "Build fitness, movement skills, teamwork, and healthy habits.",
  },
  {
    slug: "computer-science",
    name: "Computer Science",
    rating: 4.9,
    level: "Beginner",
    duration: "12 weeks",
    description: "Learn computing concepts, programming, and digital literacy.",
  },
  {
    slug: "world-history",
    name: "World History",
    rating: 4.7,
    level: "Intermediate",
    duration: "10 weeks",
    description: "Examine major civilizations, events, and historical changes.",
  },
  {
    slug: "geography",
    name: "Geography",
    rating: 4.6,
    level: "Beginner",
    duration: "10 weeks",
    description: "Explore places, environments, populations, and global systems.",
  },
  {
    slug: "business-studies",
    name: "Business Studies",
    rating: 4.8,
    level: "Beginner",
    duration: "12 weeks",
    description: "Understand entrepreneurship, finance, marketing, and management.",
  },
  {
    slug: "life-skills",
    name: "Life Skills",
    rating: 4.7,
    level: "All levels",
    duration: "8 weeks",
    description: "Develop communication, planning, decision-making, and wellbeing.",
  },
].map((course) => ({
  ...course,
  category: "General Education",
  moderationStatus: "published",
}));

async function seedCourses() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const operations = courses.map((course) => ({
    updateOne: {
      filter: {
        slug: course.slug,
      },
      update: {
        $set: course,
      },
      upsert: true,
    },
  }));

  const result = await Course.bulkWrite(operations);
  const storedCourses = await Course.find()
    .select("slug name rating level duration")
    .sort({
      rating: -1,
      name: 1,
    })
    .lean();

  console.log(
    JSON.stringify(
      {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
        total: storedCourses.length,
        courses: storedCourses,
      },
      null,
      2
    )
  );
}

seedCourses()
  .catch((error) => {
    console.error("Course seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

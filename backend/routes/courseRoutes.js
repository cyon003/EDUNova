const express = require("express");

const Course = require("../models/Course");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const courses = await Course.find().sort({
      rating: -1,
      name: 1,
    });

    return res.status(200).json(courses);
  } catch (error) {
    console.error("Get courses error:", error);

    return res.status(500).json({
      message: "Unable to load courses",
    });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const course = await Course.findOne({
      slug: req.params.slug.toLowerCase(),
    });

    if (!course) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    return res.status(200).json(course);
  } catch (error) {
    console.error("Get course error:", error);

    return res.status(500).json({
      message: "Unable to load the course",
    });
  }
});

module.exports = router;

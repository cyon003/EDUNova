const express = require("express");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validateReview, reviewUpdate } = require("../services/courseReviewService");
const router = express.Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), moderationStatus: "published" }).select("+courseReviews");
    if (!course) return res.status(404).json({ message: "Course not found" });
    const reviews = course.courseReviews || [];
    return res.json({ rating: course.reviewCount ? course.rating : 0, reviewCount: course.reviewCount || 0, reviews: reviews.map(review => ({ student: review.student, name: review.name, rating: review.rating, comment: review.comment, updatedAt: review.updatedAt })) });
  } catch (error) { next(error); }
});

router.use(authenticateToken, requireRole("student"));
async function save(req, res, next) {
  try {
    const removing = req.method === "DELETE";
    const error = !removing && validateReview(req.body);
    if (error) return res.status(400).json({ message: error });
    const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), moderationStatus: "published" });
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!await Enrollment.exists({ student: req.user._id, course: course._id })) return res.status(403).json({ message: "Enroll in this course to write a review" });
    const review = removing ? null : { student: req.user._id, name: req.user.name, rating: req.body.rating, comment: (req.body.comment || "").trim(), updatedAt: new Date() };
    const updated = await Course.findOneAndUpdate({ _id: course._id, moderationStatus: "published" }, reviewUpdate(req.user._id, review), { new: true, updatePipeline: true });
    if (!updated) return res.status(404).json({ message: "Course not found" });
    return res.json({ rating: updated.rating, reviewCount: updated.reviewCount });
  } catch (error) { next(error); }
}
router.put("/me", save);
router.delete("/me", save);
module.exports = router;

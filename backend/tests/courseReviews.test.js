const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const { validateReview, reviewUpdate } = require("../services/courseReviewService");
const router = require("../routes/courseReviewRoutes");

test("review ratings and comments are bounded; identity cannot be supplied", () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.equal(validateReview({ rating }), null);
  for (const rating of [0, 6, 1.5, "5", null]) assert.ok(validateReview({ rating }));
  assert.ok(validateReview({ rating: 5, student: "someone" }));
  assert.ok(validateReview({ rating: 5, comment: "x".repeat(2001) }));
  assert.equal(validateReview({ rating: 5, comment: "Optional" }), null);
});

test("review updates atomically replace only the authenticated student's entry and recompute totals", () => {
  const student = new mongoose.Types.ObjectId();
  const review = { student, rating: 4, comment: "$literal text" };
  const pipeline = reviewUpdate(student, review);
  assert.deepEqual(pipeline[0].$set.courseReviews.$concatArrays[0].$filter.cond, { $ne: ["$$review.student", { $literal: student }] });
  assert.deepEqual(pipeline[0].$set.courseReviews.$concatArrays[1], { $literal: [review] });
  assert.deepEqual(pipeline[1].$set.rating, { $ifNull: [{ $avg: "$courseReviews.rating" }, 0] });
  assert.ok(reviewUpdate(student, null)[0].$set.courseReviews.$filter);
});

test("review writes enforce enrollment and never take ownership from request data", async t => {
  let enrolled = false, writes = 0;
  const student = new mongoose.Types.ObjectId();
  t.mock.method(Course, "findOne", async () => ({ _id: "course" }));
  t.mock.method(Enrollment, "exists", async filter => { assert.equal(filter.student, student); return enrolled; });
  t.mock.method(Course, "findOneAndUpdate", async (_filter, pipeline) => { writes++; assert.deepEqual(pipeline[0].$set.courseReviews.$concatArrays[1].$literal[0].student, student); return { rating: 5, reviewCount: 1 }; });
  const handler = router.stack.find(layer => layer.route?.methods.put).route.stack[0].handle;
  const req = { method: "PUT", params: { slug: "science" }, user: { _id: student, name: "Student" }, body: { rating: 5 } };
  const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  await handler(req, res, error => { throw error; }); assert.equal(res.code, 403); assert.equal(writes, 0);
  enrolled = true; await handler(req, res, error => { throw error; }); assert.equal(writes, 1); assert.equal(res.body.reviewCount, 1);
});

test("legacy seed ratings never masquerade as reviews and review storage is not exposed", () => {
  const course = new Course({ rating: 4.9, courseReviews: [{ student: new mongoose.Types.ObjectId(), name: "Student", rating: 5 }] });
  assert.equal(course.toJSON().rating, 0); assert.equal(course.toJSON().reviewCount, 0); assert.equal(course.toJSON().courseReviews, undefined);
  course.reviewCount = 2; course.rating = 4.5; assert.equal(course.toJSON().rating, 4.5);
});

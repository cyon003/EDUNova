function validateReview(body) {
  if (!body || Object.keys(body).some(key => !["rating", "comment"].includes(key)) || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || (body.comment !== undefined && typeof body.comment !== "string") || (body.comment || "").trim().length > 2000) {
    return "Choose 1–5 stars and an optional comment of at most 2000 characters.";
  }
  return null;
}

// One atomic document update keeps membership, average and count consistent,
// even when the same student saves concurrently from multiple tabs.
function reviewUpdate(student, review) {
  const remaining = { $filter: { input: { $ifNull: ["$courseReviews", []] }, as: "review", cond: { $ne: ["$$review.student", { $literal: student }] } } };
  return [
    { $set: { courseReviews: review ? { $concatArrays: [remaining, { $literal: [review] }] } : remaining } },
    { $set: { reviewCount: { $size: "$courseReviews" }, rating: { $ifNull: [{ $avg: "$courseReviews.rating" }, 0] } } },
  ];
}
module.exports = { validateReview, reviewUpdate };

import { useEffect, useRef, useState } from "react";
import { API_ROOT } from "../utils/courseApi";

export default function CourseReviews({ slug, user, enrolled, onRatingChange }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const pending = useRef(false);
  const own = reviews.find(review => String(review.student) === String(user?.id));
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_ROOT}/courses/${encodeURIComponent(slug)}/reviews`, { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to load reviews"); return data; })
      .then(data => { setReviews(data.reviews); setError(""); })
      .catch(error => { if (error.name !== "AbortError") setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, reload]);
  async function save(removing = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`${API_ROOT}/courses/${encodeURIComponent(slug)}/reviews/me`, {
        method: removing ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        ...(removing ? {} : { body: JSON.stringify({ rating, comment }) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save your review");
      onRatingChange(data); setEditing(false); setLoading(true); setReload(value => value + 1);
    } catch (error) { setError(error.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="course-reviews" aria-labelledby="course-reviews-title">
    <h2 id="course-reviews-title">Student reviews</h2>
    {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => { setLoading(true); setReload(value => value + 1); }}>Retry loading reviews</button></p>}
    {loading ? <p>Loading reviews…</p> : <>
      {enrolled && user?.role === "student" && !editing && <div className="course-review-actions"><button type="button" disabled={busy} onClick={() => { setRating(own?.rating || 5); setComment(own?.comment || ""); setEditing(true); }}>{own ? "Edit your review" : "Write a Review"}</button>{own && <button type="button" disabled={busy} onClick={() => save(true)}>Delete your review</button>}</div>}
      {editing && <form onSubmit={event => { event.preventDefault(); save(); }}><fieldset disabled={busy}><legend>Your rating</legend><div className="course-review-stars" role="group" aria-label="Star rating">{[1, 2, 3, 4, 5].map(stars => <button type="button" key={stars} aria-label={`${stars} star${stars === 1 ? "" : "s"}`} aria-pressed={rating === stars} onClick={() => setRating(stars)}>{stars <= rating ? "★" : "☆"}</button>)}</div><label>Comment (optional)<textarea maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} rows={4} /></label><div className="course-review-actions"><button type="submit">{busy ? "Saving…" : "Save review"}</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div></fieldset></form>}
      {!reviews.length && <p>No reviews yet. Enrolled students can share their experience.</p>}
      {reviews.map(review => <article key={review.student}><strong>{review.name || "Student"}{String(review.student) === String(user?.id) ? " (you)" : ""}</strong><span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>{review.comment && <p>{review.comment}</p>}</article>)}
    </>}
  </section>;
}

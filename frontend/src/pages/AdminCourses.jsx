import { useEffect, useState } from "react";
import { FaArchive, FaCheck, FaPause, FaSearch, FaTimes } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

function getReviewChecks(course) {
  return [
    { label: "Course title and description are complete", passed: Boolean(course.name?.trim() && course.description?.trim()) },
    { label: "A valid category is selected", passed: Boolean(course.category?.trim()) },
    { label: "An active verified tutor is assigned", passed: Boolean(course.tutor && course.tutor.accountStatus === "approved" && course.tutor.tutorVerificationStatus === "verified") },
    { label: "The course contains at least one lesson", passed: Boolean(course.lessons?.length) },
    { label: "Every lesson has a title and video", passed: Boolean(course.lessons?.length) && course.lessons.every((lesson) => lesson.title?.trim() && lesson.videoUrl?.trim()) },
  ];
}

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [reviewCourse, setReviewCourse] = useState(null);
  const [visibleCount, setVisibleCount] = useState(5);

  const loadCourses = async () => {
    try {
      const items = await adminApi("/courses");
      setCourses(items);
      setReviewCourse((current) => current ? items.find((item) => item._id === current._id) || null : null);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    adminApi("/courses").then(setCourses).catch((error) => setMessage(error.message));
  }, []);

  const moderate = async (course, moderationStatus) => {
    const action = moderationStatus === "published" ? "publish" : moderationStatus;
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${course.name}?`)) return;
    try {
      await adminApi(`/courses/${course._id}/moderation`, {
        method: "PATCH",
        body: JSON.stringify({ moderationStatus }),
      });
      await loadCourses();
      setMessage(`${course.name} is now ${moderationStatus}.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const filteredCourses = courses.filter((course) =>
    `${course.name} ${course.tutor?.name || ""} ${course.category}`.toLowerCase().includes(search.trim().toLowerCase())
    && (status === "all" || course.moderationStatus === status)
  );
  const checks = reviewCourse ? getReviewChecks(reviewCourse) : [];
  const readyToPublish = checks.every((check) => check.passed);

  return (
    <AdminLayout title="Course Moderation">
      {message && <div className="adm-card">{message}</div>}
      <section className="adm-card">
        <div className="adm-card-hdr">
          <div><span className="adm-card-title">Submitted Courses</span><p className="adm-muted">{courses.length} courses · {courses.filter((course) => course.moderationStatus === "pending").length} awaiting review</p></div>
        </div>
        <div className="adm-search-row">
          <label className="adm-search-box"><FaSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by course, tutor, or category" /></label>
          <select className="adm-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {["pending", "published", "unpublished", "rejected", "archived"].map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Course</th><th>Assigned Tutor</th><th>Category</th><th>Lessons</th><th>Enrollments</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody>{filteredCourses.slice(0, visibleCount).map((course) => (
              <tr key={course._id}>
                <td><strong>{course.name}</strong><div className="adm-muted">{course.description}</div></td>
                <td>{course.tutor ? <><strong>{course.tutor.name}</strong><div className="adm-muted">{course.tutor.email}</div></> : <span className="adm-warning-text">Unassigned</span>}</td>
                <td>{course.category}</td>
                <td>{course.lessons?.length || 0}</td>
                <td>{course.students || 0}</td>
                <td><span className={`adm-status-pill pill-${course.moderationStatus}`}>{course.moderationStatus}</span></td>
                <td className="adm-muted">{formatAdminDate(course.updatedAt)}</td>
                <td><div className="adm-action-row">
                  <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => setReviewCourse(course)}>Review</button>
                  {course.moderationStatus !== "published" && <button className="adm-btn adm-btn-success adm-btn-sm" disabled={!getReviewChecks(course).every((check) => check.passed)} title={getReviewChecks(course).every((check) => check.passed) ? "Publish" : "Review incomplete requirements"} onClick={() => moderate(course, "published")}>Publish</button>}
                  {course.moderationStatus === "published" && <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => moderate(course, "unpublished")}>Unpublish</button>}
                  {course.moderationStatus !== "rejected" && <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => moderate(course, "rejected")}>Reject</button>}
                  {course.moderationStatus !== "archived" && <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => moderate(course, "archived")}>Archive</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {!filteredCourses.length && <p className="adm-empty">No courses match this filter.</p>}
        <AdminListControls total={filteredCourses.length} visible={visibleCount} onChange={setVisibleCount} />
      </section>

      {reviewCourse && (
        <div className="adm-modal-backdrop" role="presentation" onMouseDown={() => setReviewCourse(null)}>
          <section className="adm-review-modal" role="dialog" aria-modal="true" aria-labelledby="course-review-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="adm-review-header">
              <div><span>COURSE REVIEW</span><h2 id="course-review-title">{reviewCourse.name}</h2><p>{reviewCourse.description}</p></div>
              <button className="adm-modal-close" aria-label="Close course review" onClick={() => setReviewCourse(null)}><FaTimes /></button>
            </header>
            <div className="adm-review-summary">
              <div><small>Tutor</small><strong>{reviewCourse.tutor?.name || "Unassigned"}</strong></div>
              <div><small>Category</small><strong>{reviewCourse.category}</strong></div>
              <div><small>Lessons</small><strong>{reviewCourse.lessons?.length || 0}</strong></div>
              <div><small>Enrollments</small><strong>{reviewCourse.students || 0}</strong></div>
            </div>
            <div className="adm-review-columns">
              <div>
                <h3>Course content</h3>
                <div className="adm-lesson-review-list">
                  {reviewCourse.lessons?.map((lesson, index) => <article key={`${lesson.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{lesson.title}</strong><p>{lesson.description || "No lesson description"} · {lesson.duration || "No duration"}</p>{lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer">Open lesson video</a>}</div></article>)}
                  {!reviewCourse.lessons?.length && <p className="adm-empty">No lessons were submitted.</p>}
                </div>
              </div>
              <div>
                <h3>Platform rules check</h3>
                <div className="adm-review-checks">{checks.map((check) => <div className={check.passed ? "passed" : "failed"} key={check.label}>{check.passed ? <FaCheck /> : <FaTimes />}<span>{check.label}</span></div>)}</div>
                <p className={`adm-review-result ${readyToPublish ? "ready" : "needs-work"}`}>{readyToPublish ? "This course meets the basic publishing requirements." : "This course needs attention before publishing."}</p>
              </div>
            </div>
            <footer className="adm-review-actions">
              <button className="adm-btn adm-btn-secondary" onClick={() => moderate(reviewCourse, "archived")}><FaArchive /> Archive</button>
              <button className="adm-btn adm-btn-danger" onClick={() => moderate(reviewCourse, "rejected")}><FaTimes /> Reject</button>
              {reviewCourse.moderationStatus === "published" ? <button className="adm-btn adm-btn-secondary" onClick={() => moderate(reviewCourse, "unpublished")}><FaPause /> Unpublish</button> : <button className="adm-btn adm-btn-success" disabled={!readyToPublish} title={!readyToPublish ? "Resolve the failed checks before publishing" : "Publish course"} onClick={() => moderate(reviewCourse, "published")}><FaCheck /> Approve & Publish</button>}
            </footer>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

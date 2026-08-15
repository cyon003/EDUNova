import { useState } from "react";
import { FaBookOpen, FaCartPlus, FaCheck, FaChevronLeft, FaClock, FaPlay, FaShoppingBag, FaSignal, FaStar } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import availableCourses from "../data/courses";
import "../styles/CourseDetail.css";

function CourseLessons({ course }) {
  const lessons = course.lessons ?? [];

  return (
    <section className="course-lessons" aria-labelledby="course-lessons-title">
      <header className="course-lessons-heading">
        <div><span>Course content</span><strong>{lessons.length} lessons</strong></div>
        <h2 id="course-lessons-title">Learn one step at a time</h2>
        <p>Watch every lesson at your own pace and return whenever you need a refresher.</p>
      </header>

      {lessons.length === 0 ? (
        <div className="course-lessons-empty">
          <h3>Lessons are coming soon</h3>
          <p>The instructor has not uploaded video lessons for this course yet.</p>
        </div>
      ) : (
        <ol className="course-lesson-list">
          {lessons.map((lesson, index) => (
            <li
              className="course-lesson"
              key={`${course.slug}-${lesson.title}`}
            >
              <span className="course-lesson-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="course-lesson-video">
                <video controls preload="metadata">
                  <source src={lesson.videoUrl} type="video/mp4" />
                  Your browser does not support HTML video.
                </video>
              </div>

              <div className="course-lesson-info">
                <span><FaPlay /> Lesson {index + 1}</span>
                <h3>{lesson.title}</h3>
                <p>{lesson.description}</p>
                <small><FaClock /> {lesson.duration}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CourseDetail() {
  const { courseSlug } = useParams();
  const course = availableCourses.find((item) => item.slug === courseSlug);
  const [cartCourses, setCartCourses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edunova-cart")) || []; } catch { return []; }
  });

  if (!course) {
    return (
      <main className="course-detail-page">
        <h1>Course not found</h1>
        <Link to="/courses">← Back to Courses</Link>
      </main>
    );
  }

  const inCart = cartCourses.includes(course.slug);
  const toggleCart = () => {
    setCartCourses((current) => {
      const updated = current.includes(course.slug) ? current.filter((slug) => slug !== course.slug) : [...current, course.slug];
      localStorage.setItem("edunova-cart", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <main className="course-detail-page">
      <Link to="/courses" className="course-detail-back" aria-label="Back to courses">
        <FaChevronLeft />
      </Link>

      <div className="course-detail-layout">
        <article className="course-detail-card">
          <div className="course-detail-image">
            <img src={mathematicsImage} alt={`${course.name} course`} />
            <span><FaPlay /> Preview course</span>
          </div>

          <div className="course-detail-copy">
            <span className="course-detail-category">{course.category ?? "General Education"}</span>
            <h1>{course.name}</h1>
            <p>{course.description}</p>

            <div className="course-detail-highlights">
              <span><FaStar /><strong>{course.rating}</strong> rating</span>
              <span><FaSignal /><strong>{course.level}</strong></span>
              <span><FaClock /><strong>{course.duration}</strong></span>
              <span><FaBookOpen /><strong>{course.lessons?.length ?? 0}</strong> lessons</span>
            </div>

            <div className="course-detail-price"><span>Course price</span><strong>${course.price}</strong></div>
            <div className="course-detail-purchase">
              <button type="button" className={`course-cart-button ${inCart ? "in-cart" : ""}`} onClick={toggleCart}><FaCartPlus /> {inCart ? "Added to Cart" : "Add to Cart"}</button>
              <button type="button" className="course-buy-button"><FaShoppingBag /> Buy Now</button>
            </div>

            <div className="course-enrollment-note"><FaCheck /> Learn at your own pace with lifetime access</div>
          </div>
        </article>

        <CourseLessons course={course} />
      </div>
    </main>
  );
}

export default CourseDetail;

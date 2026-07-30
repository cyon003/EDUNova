import { FaShoppingCart } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import availableCourses from "../data/courses";
import "../styles/CourseDetail.css";

function CourseLessons({ course }) {
  const lessons = course.lessons ?? [];

  return (
    <section className="course-lessons" aria-labelledby="course-lessons-title">
      <header className="course-lessons-heading">
        <span>Course content</span>
        <h2 id="course-lessons-title">Course Lessons</h2>
        <p>
          Watch the video lessons uploaded by your instructor and learn at your
          own pace.
        </p>
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
              <div className="course-lesson-video">
                <video controls preload="metadata">
                  <source src={lesson.videoUrl} type="video/mp4" />
                  Your browser does not support HTML video.
                </video>
              </div>

              <div className="course-lesson-info">
                <span>Lesson {index + 1}</span>
                <h3>{lesson.title}</h3>
                <p>{lesson.description}</p>
                <small>{lesson.duration}</small>
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

  if (!course) {
    return (
      <main className="course-detail-page">
        <h1>Course not found</h1>
        <Link to="/courses">← Back to Courses</Link>
      </main>
    );
  }

  return (
    <main className="course-detail-page">
      <Link to="/courses" className="course-detail-back">
        ← Back to Courses
      </Link>

      <div className="course-detail-layout">
        <article className="course-detail-card">
          <img src={mathematicsImage} alt={`${course.name} course`} />

          <div>
            <span>{course.category ?? "General Education"}</span>
            <h1>{course.name}</h1>
            <p>{course.description}</p>

            <button type="button" className="course-buy-button">
              <FaShoppingCart aria-hidden="true" />
              Buy Course
            </button>

            <dl>
              <div>
                <dt>Level</dt>
                <dd>{course.level}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{course.duration}</dd>
              </div>
            </dl>
          </div>
        </article>

        <CourseLessons course={course} />
      </div>
    </main>
  );
}

export default CourseDetail;

import { Link, useParams } from "react-router-dom";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import availableCourses from "../data/courses";
import "../styles/CourseDetail.css";

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

      <article className="course-detail-card">
        <img src={mathematicsImage} alt={`${course.name} course`} />

        <div>
          <span>General Education</span>
          <h1>{course.name}</h1>
          <p>{course.description}</p>

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
    </main>
  );
}

export default CourseDetail;

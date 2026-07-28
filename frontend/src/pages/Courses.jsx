import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowLeft,
  FaHeart,
  FaRegHeart,
  FaStar,
} from "react-icons/fa";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import availableCourses from "../data/courses";
import "../styles/Courses.css";

function Courses({
  courseItems = availableCourses,
  title = "Available Courses",
}) {
  const [savedCourses, setSavedCourses] = useState([]);

  const toggleSaved = (courseSlug) => {
    setSavedCourses((current) =>
      current.includes(courseSlug)
        ? current.filter((slug) => slug !== courseSlug)
        : [...current, courseSlug],
    );
  };

  return (
    <main className="courses-page">
      <header className="courses-page-header">
        <Link to="/" className="courses-back-link">
          <FaArrowLeft /> Back
        </Link>
        <h1>{title}</h1>
      </header>

      <ul className="available-course-list">
        {courseItems.map((course) => (
          <li className="available-course-item" key={course.name}>
            <div className="available-course-image">
              <img src={mathematicsImage} alt={`${course.name} course`} />
              <button
                type="button"
                className="available-course-save"
                aria-label={`${savedCourses.includes(course.slug) ? "Remove" : "Save"} ${course.name}`}
                aria-pressed={savedCourses.includes(course.slug)}
                onClick={() => toggleSaved(course.slug)}
              >
                {savedCourses.includes(course.slug) ? (
                  <FaHeart />
                ) : (
                  <FaRegHeart />
                )}
              </button>
            </div>

            <div className="available-course-content">
              <h2>{course.name}</h2>
              <div className="available-course-meta">
                <p className="available-course-rating">
                  <FaStar /> {course.rating}
                </p>
                <span>{course.duration}</span>
              </div>
              <Link
                to={`/courses/${course.slug}`}
                className="course-details-link"
              >
                View Detail
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default Courses;

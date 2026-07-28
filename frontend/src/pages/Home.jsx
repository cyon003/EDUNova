import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaGraduationCap,
  FaHeart,
  FaRegHeart,
  FaSearch,
} from "react-icons/fa";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import "../styles/Home.css";

const courses = [
  {
    name: "Mathematics",
    description:
      "Strengthen your skills in algebra, geometry, and problem-solving.",
    rating: "4.8",
    reviews: 240,
    duration: "12 weeks",
  },
  {
    name: "Science",
    description:
      "Explore biology, chemistry, physics, and the natural world.",
    rating: "4.7",
    reviews: 198,
    duration: "14 weeks",
  },
  {
    name: "English",
    description:
      "Improve your reading, writing, grammar, and communication skills.",
    rating: "4.9",
    reviews: 275,
    duration: "10 weeks",
  },
  {
    name: "Social Studies",
    description:
      "Discover history, geography, government, and global cultures.",
    rating: "4.6",
    reviews: 165,
    duration: "12 weeks",
  },
  {
    name: "Physical Education",
    description:
      "Build healthy habits through fitness, movement, and team sports.",
    rating: "4.8",
    reviews: 184,
    duration: "8 weeks",
  },
];

const popularCourses = [...courses]
  .sort((a, b) => b.reviews - a.reviews)
  .slice(0, 4);

function CourseCard({ course, isSaved, onToggleSaved }) {
  return (
    <article className="course-card">
      <div className="course-image">
        <img src={mathematicsImage} alt={`${course.name} course`} />
        <span className="course-category">General Education</span>
        <button
          className="course-save"
          type="button"
          aria-label={`${isSaved ? "Remove" : "Save"} ${course.name}`}
          aria-pressed={isSaved}
          onClick={onToggleSaved}
        >
          {isSaved ? <FaHeart /> : <FaRegHeart />}
        </button>
      </div>

      <div className="course-information">
        <h3 className="course-name">{course.name}</h3>
        <p className="course-description">{course.description}</p>

        <div className="course-rating-duration">
          <div className="course-rating">
            <span className="rating-star">★</span>
            <strong>{course.rating}</strong>
            <span>({course.reviews} reviews)</span>
          </div>

          <div className="course-duration">
            <span>◷</span>
            <span>{course.duration}</span>
          </div>
        </div>

        <button className="course-view" type="button">
          View Course
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

function Home({ navigation = null, showFooter = true }) {
  const [savedCourses, setSavedCourses] = useState([]);

  const toggleSavedCourse = (courseName) => {
    setSavedCourses((current) =>
      current.includes(courseName)
        ? current.filter((name) => name !== courseName)
        : [...current, courseName],
    );
  };

  return (
    <main className="home">
      {navigation ?? (
        <nav className="home-nav">
          <Link to="/" className="home-logo" aria-label="EDUNOVA home">
            <span className="home-brand-icon">
              <FaGraduationCap />
            </span>
            <span className="home-brand">EDUNOVA</span>
          </Link>

          <div className="home-nav-center">
            <a href="/" className="active">
              Home
            </a>
            <a href="#courses">Courses</a>
            <Link to="/ai-chatbot">AI Chatbot</Link>
            <Link to="/ranking">Ranking</Link>
            <a href="#about">About</a>
            <label className="home-nav-search">
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                aria-label="Search courses"
                placeholder="Search"
              />
            </label>
          </div>
          <Link to="/auth" className="home-get-started">
            Get Started
          </Link>
        </nav>
      )}
      {/* Content-Header */}
      <section className="home-intro" aria-label="Introduction">
        <div className="content-text">
          <span>
            Learn Smarter With AI-Driven Education
          </span>
        </div>
      </section>
      <section className="courses-section popular-courses-section">
        <div className="course-section-title">
          <h2>Popular Courses</h2>
          <Link to="/popular-courses" className="courses-view-all">
            View All <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="content-courses">
          {popularCourses.map((course) => (
            <CourseCard
              course={course}
              isSaved={savedCourses.includes(course.name)}
              key={`popular-${course.name}`}
              onToggleSaved={() => toggleSavedCourse(course.name)}
            />
          ))}
        </div>
      </section>

      <section className="courses-section" id="courses">
        <div className="course-section-title">
          <h2>Courses</h2>
          <Link to="/courses" className="courses-view-all">
            View All <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="content-courses">
          {courses.map((course) => (
            <CourseCard
              course={course}
              isSaved={savedCourses.includes(course.name)}
              key={course.name}
              onToggleSaved={() => toggleSavedCourse(course.name)}
            />
          ))}
        </div>
      </section>

      {showFooter && (
        <footer className="home-footer" id="about">
          <div className="home-footer-about">
            <h2>About Us</h2>
            <p>
              EDUNOVA helps high-school students learn through accessible
              courses, supportive tools, and AI-assisted education.
            </p>
          </div>

          <div className="home-footer-links">
            <h3>Explore</h3>
            <a href="#courses">Courses</a>
            <Link to="/ai-chatbot">AI Chatbot</Link>
            <Link to="/ranking">Ranking</Link>
          </div>

          <div className="home-footer-contact">
            <h3>Contact</h3>
            <a href="mailto:support@edunova.com">support@edunova.com</a>
            <p>Learning without limits.</p>
          </div>

          <p className="home-footer-copyright">
            © 2026 EDUNOVA. All rights reserved.
          </p>
        </footer>
      )}
    </main>
  );
}

export default Home;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBookOpen,
  FaChartLine,
  FaComments,
  FaEnvelope,
  FaGraduationCap,
  FaHeart,
  FaRegHeart,
  FaRobot,
  FaSearch,
  FaStickyNote,
} from "react-icons/fa";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import "../styles/Home.css";
import LanguagePreference from "../components/LanguagePreference";

const courses = [
  {
    slug: "mathematics",
    name: "Mathematics",
    description:
      "Strengthen your skills in algebra, geometry, and problem-solving.",
    rating: "4.8",
    reviews: 240,
    duration: "12 weeks",
  },
  {
    slug: "science",
    name: "Science",
    description:
      "Explore biology, chemistry, physics, and the natural world.",
    rating: "4.7",
    reviews: 198,
    duration: "14 weeks",
  },
  {
    slug: "english",
    name: "English",
    description:
      "Improve your reading, writing, grammar, and communication skills.",
    rating: "4.9",
    reviews: 275,
    duration: "10 weeks",
  },
  {
    slug: "social-studies",
    name: "Social Studies",
    description:
      "Discover history, geography, government, and global cultures.",
    rating: "4.6",
    reviews: 165,
    duration: "12 weeks",
  },
  {
    slug: "physical-education",
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

        <Link className="course-view" to={`/courses/${course.slug}`}>Start Learning</Link>
      </div>
    </article>
  );
}

function Home({ navigation = null, showFooter = true }) {
  const [savedCourses, setSavedCourses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edunova-saved-courses")) || []; } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState("home");
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  useEffect(() => {
    if (carouselPaused) return undefined;
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % popularCourses.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [carouselPaused]);

  const toggleSavedCourse = (courseSlug) => {
    setSavedCourses((current) => {
      const updated = current.includes(courseSlug) ? current.filter((slug) => slug !== courseSlug) : [...current, courseSlug];
      localStorage.setItem("edunova-saved-courses", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <main className={`home ${showFooter ? "home--guest" : "home--user"}`} id="top">
      {navigation ?? (
        <nav className="home-nav">
          <Link to="/" className="home-logo" aria-label="EDUNOVA home">
            <span className="home-brand-icon">
              <FaGraduationCap />
            </span>
            <span className="home-brand">EDUNOVA</span>
          </Link>

          <div className="home-nav-center">
            <a
              href="/"
              className={activeTab === "home" ? "active" : undefined}
              aria-current={activeTab === "home" ? "page" : undefined}
              onClick={() => setActiveTab("home")}
              onFocus={() => setActiveTab("home")}
            >
              Home
            </a>
            <a
              href="#courses"
              className={activeTab === "courses" ? "active" : undefined}
              aria-current={activeTab === "courses" ? "page" : undefined}
              onClick={() => setActiveTab("courses")}
              onFocus={() => setActiveTab("courses")}
            >
              Courses
            </a>
            <Link
              to="/ai-chatbot"
              className={activeTab === "chatbot" ? "active" : undefined}
              onClick={() => setActiveTab("chatbot")}
              onFocus={() => setActiveTab("chatbot")}
            >
              AI Chatbot
            </Link>
            <Link
              to="/ranking"
              className={activeTab === "ranking" ? "active" : undefined}
              onClick={() => setActiveTab("ranking")}
              onFocus={() => setActiveTab("ranking")}
            >
              Ranking
            </Link>
            <a
              href="#about"
              className={activeTab === "about" ? "active" : undefined}
              aria-current={activeTab === "about" ? "page" : undefined}
              onClick={() => setActiveTab("about")}
              onFocus={() => setActiveTab("about")}
            >
              About
            </a>
            <label className="home-nav-search">
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                aria-label="Search courses"
                placeholder="Search"
              />
            </label>
          </div>
          <LanguagePreference />
          <Link to="/auth" className="home-get-started">
            Get Started
          </Link>
        </nav>
      )}
      <section className="home-intro" aria-label="Popular course highlights">
        <div className="home-course-carousel" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onFocus={() => setCarouselPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPaused(false); }}>
          <div className="home-carousel-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
            {popularCourses.map((course, index) => (
              <article className="home-carousel-slide" aria-hidden={activeSlide !== index} key={course.name}>
                <div>
                  <span>POPULAR COURSE</span>
                  <h1>{course.name}</h1>
                  <p>{course.description}</p>
                  <div className="home-carousel-meta"><strong>★ {course.rating}</strong><span>{course.reviews} reviews</span><span>{course.duration}</span></div>
                  <Link to="/courses" tabIndex={activeSlide === index ? 0 : -1}>Explore course <span aria-hidden="true">→</span></Link>
                </div>
                <div className="home-carousel-visual" aria-hidden="true">
                  <span>{course.name.slice(0, 2).toUpperCase()}</span>
                  <strong>0{index + 1}</strong>
                </div>
              </article>
            ))}
          </div>
          <button className="home-carousel-arrow previous" type="button" aria-label="Previous course" onClick={() => setActiveSlide((current) => (current - 1 + popularCourses.length) % popularCourses.length)}>‹</button>
          <button className="home-carousel-arrow next" type="button" aria-label="Next course" onClick={() => setActiveSlide((current) => (current + 1) % popularCourses.length)}>›</button>
          <div className="home-carousel-dots" aria-label="Choose a course slide">
            {popularCourses.map((course, index) => <button type="button" className={activeSlide === index ? "active" : undefined} aria-label={`Show ${course.name}`} aria-current={activeSlide === index ? "true" : undefined} onClick={() => setActiveSlide(index)} key={course.name} />)}
          </div>
        </div>
      </section>
      <section className="courses-section popular-courses-section">
        <div className="course-section-title">
          <h2>Popular Courses</h2>
          <Link to="/courses#popular" className="courses-view-all">
            View All
          </Link>
        </div>
        <div className="content-courses">
          {popularCourses.map((course) => (
            <CourseCard
              course={course}
              isSaved={savedCourses.includes(course.slug)}
              key={`popular-${course.name}`}
              onToggleSaved={() => toggleSavedCourse(course.slug)}
            />
          ))}
        </div>
      </section>

      <section className="courses-section" id="courses">
        <div className="course-section-title">
          <h2>Courses</h2>
          <Link to="/courses#available" className="courses-view-all">
            View All
          </Link>
        </div>
        <div className="content-courses">
          {courses.map((course) => (
            <CourseCard
              course={course}
              isSaved={savedCourses.includes(course.slug)}
              key={course.name}
              onToggleSaved={() => toggleSavedCourse(course.slug)}
            />
          ))}
        </div>
      </section>

      <section className="home-learning-journey" aria-labelledby="learning-journey-title">
        <div className="home-section-heading">
          <span>YOUR LEARNING JOURNEY</span>
          <h2 id="learning-journey-title">Everything you need to learn smarter</h2>
          <p>From your first lesson to your final achievement, EDUNOVA keeps every part of learning connected.</p>
        </div>

        <div className="home-journey-grid">
          <article>
            <span className="home-journey-number">01</span>
            <div className="home-journey-icon"><FaBookOpen /></div>
            <h3>Choose your course</h3>
            <p>Explore focused courses and continue learning at your own pace.</p>
          </article>
          <article>
            <span className="home-journey-number">02</span>
            <div className="home-journey-icon"><FaRobot /></div>
            <h3>Learn with AI support</h3>
            <p>Ask questions, simplify difficult topics, and get help whenever you need it.</p>
          </article>
          <article>
            <span className="home-journey-number">03</span>
            <div className="home-journey-icon"><FaChartLine /></div>
            <h3>Track your growth</h3>
            <p>See your progress, study activity, assignments, and achievements in one place.</p>
          </article>
        </div>
      </section>

      <section className="home-feature-showcase" aria-label="EDUNOVA features">
        <div className="home-feature-copy">
          <span>BUILT AROUND YOU</span>
          <h2>More than just online courses</h2>
          <p>Your learning tools work together, so you can spend less time organizing and more time making progress.</p>
          <Link to="/courses">Start exploring</Link>
        </div>
        <div className="home-feature-list">
          <article><FaStickyNote /><div><h3>Smart lesson notes</h3><p>Save summaries and important ideas as you learn.</p></div></article>
          <article><FaComments /><div><h3>Instructor messaging</h3><p>Connect with instructors when you need guidance.</p></div></article>
          <article><FaChartLine /><div><h3>Clear performance insights</h3><p>Understand your habits and celebrate improvement.</p></div></article>
        </div>
      </section>

      <section className="home-final-cta">
        <div>
          <span>READY WHEN YOU ARE</span>
          <h2>Turn curiosity into progress.</h2>
          <p>Find your next course and start building skills that move you forward.</p>
        </div>
        <div className="home-final-actions">
          <Link to="/courses">Explore courses</Link>
          <Link to={showFooter ? "/auth" : "/student-dashboard"}>{showFooter ? "Get started" : "My dashboard"}</Link>
        </div>
      </section>

      {showFooter && (
        <footer className="home-footer" id="about">
          <div className="home-footer-about">
            <Link to="/" className="home-footer-brand" aria-label="EDUNOVA home">
              <span><FaGraduationCap /></span>
              <strong>EDUNOVA</strong>
            </Link>
            <p>
              A connected learning space where students discover courses, get AI support, and turn steady effort into real progress.
            </p>
            <span className="home-footer-tagline">LEARNING WITHOUT LIMITS</span>
          </div>

          <div className="home-footer-links">
            <h3>Discover</h3>
            <a href="#top">Home</a>
            <a href="#courses">Courses</a>
            <Link to="/popular-courses">Popular Courses</Link>
          </div>

          <div className="home-footer-links">
            <h3>Learning tools</h3>
            <Link to="/ai-chatbot">AI Chatbot</Link>
            <Link to="/ranking">Ranking</Link>
            <Link to="/student-dashboard">Student Dashboard</Link>
          </div>

          <div className="home-footer-contact">
            <span><FaComments /></span>
            <div><h3>Need some help?</h3><p>Our learning support team is ready to point you in the right direction.</p></div>
            <a href="mailto:support@edunova.com"><FaEnvelope /> support@edunova.com</a>
          </div>

          <div className="home-footer-bottom">
            <p>© 2026 EDUNOVA. All rights reserved.</p>
          </div>
        </footer>
      )}
    </main>
  );
}

export default Home;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaBookOpen, FaCompass, FaFire, FaGraduationCap, FaHeart, FaLaptopCode, FaRegHeart, FaRobot, FaSearch, FaStar } from "react-icons/fa";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import { courseDuration, courseThumbnail, formatCoursePrice, getPublicCourses } from "../utils/courseApi";
import "../styles/Courses.css";

function CourseList({ courseItems, savedCourses, onToggleSaved }) {
  return (
    <ul className="available-course-list">
      {courseItems.map((course) => (
        <li className="available-course-item" key={course._id || course.slug}>
          <div className="available-course-image">
            <img src={courseThumbnail(course, mathematicsImage)} alt={`${course.name} course`} />
            <span className="available-course-level">{course.level}</span>
            <button type="button" className="available-course-save" aria-label={`${savedCourses.includes(course.slug) ? "Remove" : "Save"} ${course.name}`} aria-pressed={savedCourses.includes(course.slug)} onClick={() => onToggleSaved(course.slug)}>
              {savedCourses.includes(course.slug) ? <FaHeart /> : <FaRegHeart />}
            </button>
          </div>
          <div className="available-course-content">
            <div className="available-course-labels"><span className="available-course-category">{course.category}</span></div>
            <div className="available-course-title-row">
              <h2>{course.name}</h2>
              <strong className="available-course-price">{formatCoursePrice(course.price)}</strong>
            </div>
            <p className="available-course-description">{course.description}</p>
            <div className="available-course-meta">
              <p className="available-course-rating"><FaStar /> {course.rating}</p>
              <span>{courseDuration(course)}</span>
            </div>
            <Link to={`/courses/${course.slug}`} state={{ from: "/courses" }} className="course-details-link">View course</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Courses() {
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savedCourses, setSavedCourses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edunova-saved-courses")) || []; } catch { return []; }
  });
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get("search") || "");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("rating");
  const [savedOnly, setSavedOnly] = useState(false);
  const [showLearningPathBar, setShowLearningPathBar] = useState(false);
  const [learningPathsVisible, setLearningPathsVisible] = useState(false);
  const popularCourses = [...catalogCourses]
    .sort((first, second) => Number(second.rating) - Number(first.rating))
    .slice(0, 4);
  const categories = ["All", ...new Set(catalogCourses.map((course) => course.category))];
  const filteredCourses = catalogCourses
    .filter((course) => category === "All" || course.category === category)
    .filter((course) => !savedOnly || savedCourses.includes(course.slug))
    .filter((course) => `${course.name} ${course.description} ${course.category}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .sort((first, second) => sortBy === "name" ? first.name.localeCompare(second.name) : Number(second.rating) - Number(first.rating));

  useEffect(() => {
    let active = true;
    getPublicCourses()
      .then((courses) => {
        if (!active) return;
        setCatalogCourses(courses);
      })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sectionId = window.location.hash.slice(1);
    if (!sectionId) return;
    requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    const paths = document.getElementById("learning-paths");
    if (!paths) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setLearningPathsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(paths);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateLearningPathBar = () => {
      const aiPanel = document.getElementById("course-ai-recommendation");
      const paths = document.getElementById("learning-paths");
      if (!aiPanel || !paths) return;
      const passedAiPanel = aiPanel.getBoundingClientRect().bottom < 12;
      const pathsAreVisible = paths.getBoundingClientRect().top < window.innerHeight;
      setShowLearningPathBar(passedAiPanel && !pathsAreVisible);
    };
    updateLearningPathBar();
    window.addEventListener("scroll", updateLearningPathBar, { passive: true });
    window.addEventListener("resize", updateLearningPathBar);
    return () => {
      window.removeEventListener("scroll", updateLearningPathBar);
      window.removeEventListener("resize", updateLearningPathBar);
    };
  }, []);

  const toggleSaved = (courseSlug) => {
    setSavedCourses((current) => {
      const updated = current.includes(courseSlug) ? current.filter((slug) => slug !== courseSlug) : [...current, courseSlug];
      localStorage.setItem("edunova-saved-courses", JSON.stringify(updated));
      return updated;
    });
  };


  return (
    <main className="courses-page">
      <header className="courses-page-header">
        <div className="courses-header-hero">
          <Link to="/" className="courses-brand-logo" aria-label="EDUNOVA homepage"><span><FaGraduationCap /></span><strong>EDUNOVA</strong></Link>
          <div className="courses-heading-copy">
            <span>EXPLORE EDUNOVA</span>
            <h1>Explore Courses</h1>
            <p>Choose a subject, build useful skills, and move forward one lesson at a time.</p>
          </div>
          <div className="courses-header-summary">
            <span><FaBookOpen /></span>
            <div><strong>{catalogCourses.length}</strong><small>courses to explore</small></div>
          </div>
        </div>
      </header>

      <div className="course-catalog-tools">
        <label className="course-search"><FaSearch /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search courses" aria-label="Search courses" /></label>
        <div className="course-category-filters" aria-label="Filter by category">
          {categories.map((item) => <button type="button" className={category === item ? "active" : undefined} onClick={() => setCategory(item)} key={item}>{item}</button>)}
        </div>
        <div className="course-filter-actions">
          <button type="button" className={savedOnly ? "active" : undefined} onClick={() => setSavedOnly((current) => !current)}><FaHeart /> Saved</button>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort courses"><option value="rating">Top rated</option><option value="name">Course name</option></select>
        </div>
      </div>

      {loading && <div className="course-empty-results"><FaBookOpen /><h3>Loading approved courses</h3></div>}
      {!loading && loadError && <div className="course-empty-results"><FaBookOpen /><h3>Courses are unavailable</h3><p>{loadError}</p></div>}
      {!loading && !loadError && catalogCourses.length === 0 && <div className="course-empty-results"><FaBookOpen /><h3>No approved courses yet</h3><p>New tutor courses will appear here after admin approval.</p></div>}

      {!loading && !loadError && catalogCourses.length > 0 && <section className="course-collection popular-course-collection" id="popular">
        <header>
          <div><span><FaFire /></span><div><small>STUDENT FAVORITES</small><h2>Popular Courses</h2><p>Highly rated courses learners are enjoying right now.</p></div></div>
          <strong>Top {popularCourses.length}</strong>
        </header>
        <CourseList courseItems={popularCourses} savedCourses={savedCourses} onToggleSaved={toggleSaved} />
      </section>}

      <section className="course-match-panel" id="course-ai-recommendation">
        <div><span><FaRobot /></span><div><small>PERSONALIZED GUIDANCE</small><h2>Not sure where to begin?</h2><p>Tell the AI assistant what you want to learn and get a course recommendation.</p></div></div>
        <Link to="/ai-chatbot">Ask AI</Link>
      </section>

      {!loading && !loadError && catalogCourses.length > 0 && <section className="course-collection" id="available">
        <header>
          <div><span><FaBookOpen /></span><div><small>FULL CATALOG</small><h2>Available Courses</h2><p>Explore every subject and find the right course for your goals.</p></div></div>
          <strong>{catalogCourses.length} courses</strong>
        </header>
        <div className="course-results-summary"><span>{filteredCourses.length} {filteredCourses.length === 1 ? "course" : "courses"}</span>{(searchQuery || category !== "All" || savedOnly) && <button type="button" onClick={() => { setSearchQuery(""); setCategory("All"); setSavedOnly(false); }}>Clear filters</button>}</div>
        {filteredCourses.length ? <CourseList courseItems={filteredCourses} savedCourses={savedCourses} onToggleSaved={toggleSaved} /> : <div className="course-empty-results"><FaSearch /><h3>No courses found</h3><p>Try another search or clear your filters.</p></div>}
      </section>}

      <section className={`learning-paths ${learningPathsVisible ? "visible" : ""}`} id="learning-paths" aria-labelledby="learning-paths-title">
        <header>
          <div><span>CHOOSE YOUR DIRECTION</span><h2 id="learning-paths-title">Build a learning path that fits your goal</h2><p>Start with a direction and follow a small set of courses designed to help you move forward.</p></div>
          <Link to="/ai-chatbot"><FaRobot /> Build my path with AI</Link>
        </header>
        <div className="learning-path-grid">
          <article>
            <div className="learning-path-icon"><FaGraduationCap /></div>
            <span>ACADEMIC GROWTH</span>
            <h3>Improve school performance</h3>
            <p>Strengthen the core subjects used across your studies.</p>
            <div><Link to="/courses?search=Mathematics">Mathematics</Link><Link to="/courses?search=Science">Science</Link><Link to="/courses?search=English">English</Link></div>
          </article>
          <article>
            <div className="learning-path-icon"><FaLaptopCode /></div>
            <span>DIGITAL FUTURE</span>
            <h3>Build technology skills</h3>
            <p>Develop digital confidence and practical problem-solving skills.</p>
            <div><Link to="/courses?search=Computer%20Science">Computer Science</Link><Link to="/courses?search=Mathematics">Mathematics</Link></div>
          </article>
          <article>
            <div className="learning-path-icon"><FaCompass /></div>
            <span>REAL-WORLD SKILLS</span>
            <h3>Prepare for life and work</h3>
            <p>Build communication, business, and decision-making abilities.</p>
            <div><Link to="/courses?search=Life%20Skills">Life Skills</Link><Link to="/courses?search=Business%20Studies">Business Studies</Link></div>
          </article>
        </div>
      </section>

      {showLearningPathBar && (
        <aside className="learning-path-sticky" aria-label="Learning path suggestion">
          <div><FaCompass /><span><strong>Build your learning path</strong><small>Turn your goals into a simple course plan.</small></span></div>
          <Link to="/ai-chatbot"><FaRobot /> Ask AI</Link>
        </aside>
      )}

    </main>
  );
}

export default Courses;

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBookOpen, FaChevronRight, FaClock, FaGraduationCap, FaPlay, FaSearch } from "react-icons/fa";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import { API_ROOT, courseDuration, courseThumbnail } from "../utils/courseApi";
import "../styles/MyCourses.css";

function MyCourses() {
  const [enrollments, setEnrollments] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadEnrollments = async () => {
      try {
        const response = await fetch(`${API_ROOT}/enrollments/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load courses");
        setEnrollments(data.filter((item) => item.course));
        setOffline(false);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadEnrollments();
    return () => controller.abort();
  }, []);

  const courses = useMemo(() => enrollments.map((enrollment) => {
    const mergedCourse = { ...enrollment.course, lessons: enrollment.course?.lessons || [] };
    const totalLessons = mergedCourse.lessons.length;
    const completed = enrollment.completedLessons?.length || 0;
    const progress = totalLessons ? Math.min(Math.round(completed / totalLessons * 100), 100) : 0;
    const completionStatus = totalLessons > 0 && progress === 100 ? "Completed" : progress > 0 ? "In progress" : "Not started";
    return { ...mergedCourse, enrollmentId: enrollment._id, completed, totalLessons, progress, completionStatus, currentLessonIndex: enrollment.currentLessonIndex || 0 };
  }), [enrollments]);

  const filteredCourses = courses.filter((course) => `${course.name} ${course.category}`.toLowerCase().includes(query.trim().toLowerCase())).filter((course) => status === "All" || (status === "Completed" ? course.progress === 100 : course.progress < 100));

  return <main className="my-courses-page">
    <header className="my-courses-topbar"><Link to="/" className="my-courses-brand"><span><FaGraduationCap /></span><strong>EDUNOVA</strong></Link><Link to="/student-dashboard">Dashboard</Link></header>
    <section className="my-courses-hero"><div><span>MY LEARNING</span><h1>My Courses</h1><p>Continue enrolled courses, track lesson progress, and unlock course missions.</p></div><article><strong>{courses.length}</strong><span>Enrolled courses</span><small>{courses.filter((course) => course.progress === 100).length} completed</small></article></section>

    <section className="my-courses-tools"><label><FaSearch /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search my courses" /></label><div>{["All", "In Progress", "Completed"].map((item) => <button type="button" className={status === item ? "active" : undefined} onClick={() => setStatus(item)} key={item}>{item}</button>)}</div><Link to="/courses">Explore Courses</Link></section>
    {offline && <p className="my-courses-offline">Showing courses saved on this device. Start the backend and connect MongoDB to synchronize your account.</p>}

    {loading && <div className="my-courses-state"><span className="my-courses-loader" /><h2>Loading your courses</h2></div>}
    {!loading && error && <div className="my-courses-state"><FaBookOpen /><h2>Unable to load your courses</h2><p>{error}</p></div>}
    {!loading && !error && !filteredCourses.length && <div className="my-courses-state"><FaBookOpen /><h2>{courses.length ? "No matching courses" : "You have not enrolled yet"}</h2><p>{courses.length ? "Try another search or progress filter." : "Explore the course catalog and enroll to start learning."}</p><Link to="/courses">Explore Courses</Link></div>}

    {!loading && !error && filteredCourses.length > 0 && <section className="my-courses-grid">{filteredCourses.map((course) => <article key={course.enrollmentId}>
      <div className="my-course-image"><img src={courseThumbnail(course, mathematicsImage)} alt="" /><span>{course.category}</span><b>{course.progress}%</b></div>
      <div className="my-course-content"><small>{course.level} · {courseDuration(course)}</small><h2>{course.name}</h2><p>{course.description}</p><div className="my-course-progress"><div><span>{course.completionStatus}</span><strong>{course.completed}/{course.totalLessons} lessons</strong></div><i><b style={{ width: `${course.progress}%` }} /></i></div><div className="my-course-actions"><span><FaClock /> {course.progress}% complete</span><Link to={course.totalLessons ? `/courses/${course.slug}/learn/${course.currentLessonIndex + 1}` : `/courses/${course.slug}`}><FaPlay /> {course.progress === 100 ? "Review Course" : course.progress ? "Continue" : "Start Course"}<FaChevronRight /></Link></div></div>
    </article>)}</section>}
  </main>;
}

export default MyCourses;

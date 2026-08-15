import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBookOpen, FaChevronRight, FaClock, FaGraduationCap, FaPlay, FaSearch } from "react-icons/fa";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import availableCourses from "../data/courses";
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
        const response = await fetch("http://localhost:5050/api/enrollments/me", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load courses");
        setEnrollments(data);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          try {
            const localSlugs = JSON.parse(localStorage.getItem("edunova-enrolled-courses")) || [];
            setEnrollments(localSlugs.map((slug) => ({ _id: `local-${slug}`, course: availableCourses.find((course) => course.slug === slug), completedLessons: JSON.parse(localStorage.getItem(`edunova-lesson-progress-${slug}`)) || [], completedMissions: JSON.parse(localStorage.getItem(`edunova-mission-progress-${slug}`)) || [] })).filter((item) => item.course));
            setOffline(true);
          } catch {
            setError(requestError.message);
          }
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadEnrollments();
    return () => controller.abort();
  }, []);

  const courses = useMemo(() => enrollments.map((enrollment) => {
    const catalogCourse = availableCourses.find((item) => item.slug === enrollment.course?.slug) || {};
    const mergedCourse = { ...catalogCourse, ...enrollment.course, lessons: enrollment.course?.lessons?.length ? enrollment.course.lessons : catalogCourse.lessons || [] };
    const totalLessons = mergedCourse.lessons.length;
    const completed = enrollment.completedLessons?.length || 0;
    const progress = totalLessons ? Math.min(Math.round(completed / totalLessons * 100), 100) : 0;
    return { ...mergedCourse, enrollmentId: enrollment._id, completed, totalLessons, progress };
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
      <div className="my-course-image"><img src={mathematicsImage} alt="" /><span>{course.category}</span><b>{course.progress}%</b></div>
      <div className="my-course-content"><small>{course.level} · {course.duration}</small><h2>{course.name}</h2><p>{course.description}</p><div className="my-course-progress"><div><span>Course progress</span><strong>{course.completed}/{course.totalLessons} lessons</strong></div><i><b style={{ width: `${course.progress}%` }} /></i></div><div className="my-course-actions"><span><FaClock /> Last opened recently</span><Link to={`/courses/${course.slug}`} state={{ from: "/my-courses" }}><FaPlay /> {course.progress ? "Continue" : "Start Course"}<FaChevronRight /></Link></div></div>
    </article>)}</section>}
  </main>;
}

export default MyCourses;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaBookOpen, FaSearch, FaUserGraduate } from "react-icons/fa";
import "../styles/DashboardSearch.css";
import { API_ROOT } from "../utils/courseApi";

function DashboardSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], courses: [] });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_ROOT}/search?q=${encodeURIComponent(trimmedQuery)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) setResults(data);
      } catch (error) {
        if (error.name !== "AbortError") setResults({ users: [], courses: [] });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query]);

  const showResults = focused && query.trim().length >= 2;

  return (
    <div className="dashboard-search" onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <label><FaSearch /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, courses or instructors" aria-label="Search users, courses or instructors" /></label>
      {showResults && (
        <div className="dashboard-search-results">
          {loading && <p className="dashboard-search-state">Searching...</p>}
          {!loading && results.courses.length > 0 && <section><h3>Courses</h3>{results.courses.map((course) => <Link to={`/courses/${course.slug}`} key={course._id}><span><FaBookOpen /></span><div><strong>{course.name}</strong><small>{course.category}</small></div></Link>)}</section>}
          {!loading && results.users.length > 0 && <section><h3>People</h3>{results.users.map((person) => <div className="dashboard-person-result" key={person._id}><span><FaUserGraduate /></span><div><strong>{person.name}</strong><small>{person.role === "tutor" ? "Instructor" : "Student"}</small></div></div>)}</section>}
          {!loading && !results.courses.length && !results.users.length && <p className="dashboard-search-state">No matching users or courses found.</p>}
        </div>
      )}
    </div>
  );
}

export default DashboardSearch;

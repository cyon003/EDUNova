import { useState } from "react";
import {
  FaArrowLeft,
  FaBookOpen,
  FaChartBar,
  FaChartLine,
  FaCheckCircle,
  FaUsers,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import "../styles/TutorAnalytics.css";

const courseAnalytics = [
  {
    id: "course-1",
    course: "Python Basics",
    enrollment: 48,
    enrollmentGrowth: 12,
    completionRate: 72,
    averageScore: 78,
    lessonEngagement: 84,
    completedStudents: 35,
  },
  {
    id: "course-2",
    course: "React Development",
    enrollment: 36,
    enrollmentGrowth: 8,
    completionRate: 64,
    averageScore: 74,
    lessonEngagement: 79,
    completedStudents: 23,
  },
  {
    id: "course-3",
    course: "Database Fundamentals",
    enrollment: 42,
    enrollmentGrowth: 5,
    completionRate: 55,
    averageScore: 69,
    lessonEngagement: 71,
    completedStudents: 23,
  },
];

function getAverage(data, field) {
  if (data.length === 0) return 0;
  const total = data.reduce((sum, course) => sum + course[field], 0);
  return Math.round(total / data.length);
}

function TutorAnalytics() {
  const navigate = useNavigate();
  const [courseFilter, setCourseFilter] = useState("All");

  const visibleCourses =
    courseFilter === "All"
      ? courseAnalytics
      : courseAnalytics.filter((course) => course.course === courseFilter);
  const totalEnrollment = visibleCourses.reduce(
    (total, course) => total + course.enrollment,
    0
  );
  const averageCompletion = getAverage(visibleCourses, "completionRate");
  const averageScore = getAverage(visibleCourses, "averageScore");
  const averageEngagement = getAverage(visibleCourses, "lessonEngagement");

  return (
    <main className="tutor-analytics-page">
      <header className="tutor-analytics-header">
        <div>
          <button
            type="button"
            className="tutor-analytics-back"
            onClick={() => navigate("/tutor-dashboard")}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
          <p>ANALYTICS</p>
          <h1>Course Performance</h1>
          <span>
            Monitor enrollment, completion, assessment scores and lesson
            engagement.
          </span>
        </div>

        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          aria-label="Filter analytics by course"
        >
          <option value="All">All assigned courses</option>
          {courseAnalytics.map((course) => (
            <option value={course.course} key={course.id}>
              {course.course}
            </option>
          ))}
        </select>
      </header>

      <section className="tutor-analytics-summary" aria-label="Analytics summary">
        <article>
          <FaUsers />
          <div>
            <strong>{totalEnrollment}</strong>
            <span>Total enrollment</span>
          </div>
        </article>
        <article>
          <FaCheckCircle />
          <div>
            <strong>{averageCompletion}%</strong>
            <span>Completion rate</span>
          </div>
        </article>
        <article>
          <FaChartLine />
          <div>
            <strong>{averageScore}%</strong>
            <span>Average score</span>
          </div>
        </article>
        <article>
          <FaBookOpen />
          <div>
            <strong>{averageEngagement}%</strong>
            <span>Lesson engagement</span>
          </div>
        </article>
      </section>

      <section className="tutor-analytics-grid">
        <article className="tutor-analytics-panel">
          <div className="tutor-analytics-panel-header">
            <div>
              <h2>Course Enrollment</h2>
              <p>Students enrolled in each assigned course.</p>
            </div>
            <FaUsers />
          </div>

          <div className="tutor-enrollment-chart">
            {visibleCourses.map((course) => (
              <div className="tutor-enrollment-row" key={course.id}>
                <div>
                  <strong>{course.course}</strong>
                  <span>+{course.enrollmentGrowth}% growth</span>
                </div>
                <div className="tutor-analytics-bar">
                  <span
                    style={{ width: `${Math.min(course.enrollment * 2, 100)}%` }}
                  />
                </div>
                <strong>{course.enrollment}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="tutor-analytics-panel">
          <div className="tutor-analytics-panel-header">
            <div>
              <h2>Learning Performance</h2>
              <p>Average results across your courses.</p>
            </div>
            <FaChartBar />
          </div>

          <div className="tutor-performance-chart">
            <div>
              <span>Completion</span>
              <strong>{averageCompletion}%</strong>
              <div className="tutor-analytics-bar">
                <span style={{ width: `${averageCompletion}%` }} />
              </div>
            </div>
            <div>
              <span>Assessment score</span>
              <strong>{averageScore}%</strong>
              <div className="tutor-analytics-bar">
                <span style={{ width: `${averageScore}%` }} />
              </div>
            </div>
            <div>
              <span>Lesson engagement</span>
              <strong>{averageEngagement}%</strong>
              <div className="tutor-analytics-bar">
                <span style={{ width: `${averageEngagement}%` }} />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="tutor-analytics-table-panel">
        <div className="tutor-analytics-panel-header">
          <div>
            <h2>Course Comparison</h2>
            <p>Detailed performance for assigned courses only.</p>
          </div>
        </div>

        <div className="tutor-analytics-table-wrapper">
          <table className="tutor-analytics-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Enrollment</th>
                <th>Completed</th>
                <th>Completion</th>
                <th>Average score</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {visibleCourses.map((course) => (
                <tr key={course.id}>
                  <td><strong>{course.course}</strong></td>
                  <td>{course.enrollment}</td>
                  <td>{course.completedStudents}</td>
                  <td>
                    <span
                      className={
                        course.completionRate < 60
                          ? "analytics-warning"
                          : "analytics-success"
                      }
                    >
                      {course.completionRate}%
                    </span>
                  </td>
                  <td>{course.averageScore}%</td>
                  <td>{course.lessonEngagement}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default TutorAnalytics;

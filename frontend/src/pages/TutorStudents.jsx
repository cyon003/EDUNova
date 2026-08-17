import { useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaBookOpen,
  FaChartLine,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSearch,
  FaUserGraduate,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import "../styles/TutorStudents.css";

const assignedCourses = [
  "Python Basics",
  "React Development",
  "Database Fundamentals",
];

const assignedStudents = [
  {
    id: "student-1",
    name: "May Thu",
    email: "maythu@example.com",
    course: "Python Basics",
    completion: 32,
    quizAverage: 46,
    completedLessons: 4,
    totalLessons: 12,
    lastActive: "17 Aug 2026",
  },
  {
    id: "student-2",
    name: "Aung Min",
    email: "aungmin@example.com",
    course: "React Development",
    completion: 58,
    quizAverage: 41,
    completedLessons: 7,
    totalLessons: 12,
    lastActive: "16 Aug 2026",
  },
  {
    id: "student-3",
    name: "Su Su",
    email: "susu@example.com",
    course: "Python Basics",
    completion: 88,
    quizAverage: 91,
    completedLessons: 11,
    totalLessons: 12,
    lastActive: "Today",
  },
  {
    id: "student-4",
    name: "Ko Lin",
    email: "kolin@example.com",
    course: "Database Fundamentals",
    completion: 73,
    quizAverage: 78,
    completedLessons: 8,
    totalLessons: 11,
    lastActive: "Today",
  },
  {
    id: "student-5",
    name: "Nandar Hla",
    email: "nandar@example.com",
    course: "React Development",
    completion: 94,
    quizAverage: 87,
    completedLessons: 15,
    totalLessons: 16,
    lastActive: "15 Aug 2026",
  },
  {
    id: "student-6",
    name: "Min Khant",
    email: "minkhant@example.com",
    course: "Database Fundamentals",
    completion: 45,
    quizAverage: 52,
    completedLessons: 5,
    totalLessons: 11,
    lastActive: "12 Aug 2026",
  },
];

function needsSupport(student) {
  return student.completion < 50 || student.quizAverage < 50;
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TutorStudents() {
  const navigate = useNavigate();
  const [courseFilter, setCourseFilter] = useState("All");
  const [supportOnly, setSupportOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(
    assignedStudents[0].id
  );

  const filteredStudents = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return assignedStudents.filter((student) => {
      const matchesCourse =
        courseFilter === "All" || student.course === courseFilter;
      const matchesSupport = !supportOnly || needsSupport(student);
      const matchesSearch =
        !searchValue ||
        student.name.toLowerCase().includes(searchValue) ||
        student.email.toLowerCase().includes(searchValue);

      return matchesCourse && matchesSupport && matchesSearch;
    });
  }, [courseFilter, search, supportOnly]);

  const selectedStudent =
    assignedStudents.find(
      (student) => student.id === selectedStudentId
    ) || filteredStudents[0];

  const averageCompletion = Math.round(
    assignedStudents.reduce(
      (total, student) => total + student.completion,
      0
    ) / assignedStudents.length
  );

  const averageQuizScore = Math.round(
    assignedStudents.reduce(
      (total, student) => total + student.quizAverage,
      0
    ) / assignedStudents.length
  );

  const supportCount = assignedStudents.filter(needsSupport).length;

  return (
    <main className="tutor-students-page">
      <header className="tutor-students-header">
        <div>
          <button
            type="button"
            className="tutor-students-back"
            onClick={() => navigate("/tutor-dashboard")}
          >
            <FaArrowLeft />
            Back to Dashboard
          </button>

          <p>STUDENT PROGRESS</p>
          <h1>Assigned Students</h1>
          <span>
            Monitor learners enrolled in your assigned courses.
          </span>
        </div>
      </header>

      <section
        className="tutor-student-summary"
        aria-label="Student progress summary"
      >
        <article>
          <FaUserGraduate />
          <div>
            <strong>{assignedStudents.length}</strong>
            <span>Assigned students</span>
          </div>
        </article>

        <article>
          <FaChartLine />
          <div>
            <strong>{averageCompletion}%</strong>
            <span>Average completion</span>
          </div>
        </article>

        <article>
          <FaCheckCircle />
          <div>
            <strong>{averageQuizScore}%</strong>
            <span>Average quiz score</span>
          </div>
        </article>

        <article className="support-summary">
          <FaExclamationTriangle />
          <div>
            <strong>{supportCount}</strong>
            <span>Need support</span>
          </div>
        </article>
      </section>

      <section className="tutor-student-filters">
        <label className="tutor-student-search">
          <FaSearch />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
          />
        </label>

        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          aria-label="Filter students by course"
        >
          <option value="All">All assigned courses</option>
          {assignedCourses.map((course) => (
            <option value={course} key={course}>
              {course}
            </option>
          ))}
        </select>

        <label className="tutor-support-toggle">
          <input
            type="checkbox"
            checked={supportOnly}
            onChange={(event) => setSupportOnly(event.target.checked)}
          />
          Needs support only
        </label>
      </section>

      <section className="tutor-student-workspace">
        <div className="tutor-student-list-panel">
          <div className="tutor-student-list-heading">
            <div>
              <h2>Students</h2>
              <p>{filteredStudents.length} results</p>
            </div>
          </div>

          <div className="tutor-student-list">
            {filteredStudents.map((student) => (
              <button
                type="button"
                className={
                  student.id === selectedStudent?.id
                    ? "tutor-student-row active"
                    : "tutor-student-row"
                }
                onClick={() => setSelectedStudentId(student.id)}
                key={student.id}
              >
                <span className="tutor-student-row-avatar">
                  {getInitials(student.name)}
                </span>

                <span className="tutor-student-row-copy">
                  <strong>{student.name}</strong>
                  <small>{student.course}</small>
                </span>

                <span
                  className={
                    needsSupport(student)
                      ? "tutor-student-status support"
                      : "tutor-student-status on-track"
                  }
                >
                  {needsSupport(student) ? "Support" : "On track"}
                </span>
              </button>
            ))}

            {filteredStudents.length === 0 && (
              <div className="tutor-students-empty">
                No students match these filters.
              </div>
            )}
          </div>
        </div>

        {selectedStudent ? (
          <article className="tutor-student-detail">
            <header>
              <span className="tutor-student-detail-avatar">
                {getInitials(selectedStudent.name)}
              </span>

              <div>
                <h2>{selectedStudent.name}</h2>
                <p>{selectedStudent.email}</p>
                <span>{selectedStudent.course}</span>
              </div>

              <span
                className={
                  needsSupport(selectedStudent)
                    ? "tutor-student-detail-badge support"
                    : "tutor-student-detail-badge on-track"
                }
              >
                {needsSupport(selectedStudent)
                  ? "Needs support"
                  : "On track"}
              </span>
            </header>

            <div className="tutor-student-progress-grid">
              <section>
                <FaBookOpen />
                <span>Course completion</span>
                <strong>{selectedStudent.completion}%</strong>
                <div className="tutor-student-progress-bar">
                  <span
                    style={{ width: `${selectedStudent.completion}%` }}
                  />
                </div>
              </section>

              <section>
                <FaCheckCircle />
                <span>Quiz average</span>
                <strong>{selectedStudent.quizAverage}%</strong>
                <div className="tutor-student-progress-bar">
                  <span
                    style={{ width: `${selectedStudent.quizAverage}%` }}
                  />
                </div>
              </section>
            </div>

            <div className="tutor-student-learning-details">
              <div>
                <span>Lessons completed</span>
                <strong>
                  {selectedStudent.completedLessons} /{" "}
                  {selectedStudent.totalLessons}
                </strong>
              </div>

              <div>
                <span>Last active</span>
                <strong>{selectedStudent.lastActive}</strong>
              </div>
            </div>

            {needsSupport(selectedStudent) && (
              <div className="tutor-student-warning">
                <FaExclamationTriangle />
                <div>
                  <strong>Follow-up recommended</strong>
                  <p>
                    This learner has completion or quiz results below
                    50%. Consider providing feedback or extra support.
                  </p>
                </div>
              </div>
            )}
          </article>
        ) : (
          <div className="tutor-student-detail tutor-students-empty">
            Select a student to view their progress.
          </div>
        )}
      </section>
    </main>
  );
}

export default TutorStudents;

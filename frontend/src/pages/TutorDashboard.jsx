import {
  FaBookOpen,
  FaBullhorn,
  FaCalendarAlt,
  FaChartLine,
  FaClipboardCheck,
  FaGraduationCap,
  FaHome,
  FaIdCard,
  FaSignOutAlt,
  FaUserGraduate,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import MessageBox from "../components/MessageBox";
import "../styles/TutorDashboard.css";

const statistics = [
  {
    id: 1,
    label: "Assigned Courses",
    value: 4,
    icon: FaBookOpen,
    color: "purple",
  },
  {
    id: 2,
    label: "Enrolled Students",
    value: 126,
    icon: FaUserGraduate,
    color: "blue",
  },
  {
    id: 3,
    label: "Pending Submissions",
    value: 18,
    icon: FaClipboardCheck,
    color: "orange",
  },
  {
    id: 4,
    label: "Upcoming Deadlines",
    value: 6,
    icon: FaCalendarAlt,
    color: "green",
  },
];

const courses = [
  {
    id: 1,
    title: "Python Basics",
    students: 48,
    completion: 72,
    status: "Published",
  },
  {
    id: 2,
    title: "React Development",
    students: 36,
    completion: 64,
    status: "Published",
  },
  {
    id: 3,
    title: "Database Fundamentals",
    students: 42,
    completion: 55,
    status: "Pending",
  },
];

const deadlines = [
  {
    id: 1,
    title: "Python Functions Assignment",
    course: "Python Basics",
    date: "20 Aug",
  },
  {
    id: 2,
    title: "React Components Quiz",
    course: "React Development",
    date: "23 Aug",
  },
  {
    id: 3,
    title: "MongoDB Project",
    course: "Database Fundamentals",
    date: "27 Aug",
  },
];

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user");

    if (!rawUser) {
      return null;
    }

    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function TutorDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const openTutorCourses = () => {
    navigate("/tutor-courses");
  };

  const openTutorAssessments = () => {
    navigate("/tutor-assessments");
  };

  const openTutorStudents = () => {
    navigate("/tutor-students");
  };

  const openTutorCommunication = () => {
    navigate("/tutor-communication");
  };

  const openTutorSessions = () => {
    navigate("/tutor-sessions");
  };

  const openTutorAnalytics = () => {
    navigate("/tutor-analytics");
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/auth";
  };

  return (
    <main className="tutor-dashboard">
      <aside className="tutor-sidebar">
        <div className="tutor-brand">
          <span>
            <FaGraduationCap />
          </span>

          <strong>EDUNOVA</strong>
        </div>

        <p className="tutor-role">Tutor Portal</p>

        <nav
          className="tutor-navigation"
          aria-label="Tutor navigation"
        >
          <button
            type="button"
            className="active"
            onClick={() => navigate("/tutor-dashboard")}
          >
            <FaHome />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/tutor-application")}
          >
            <FaIdCard />
            <span>Tutor Verification</span>
          </button>

          <button
            type="button"
            onClick={openTutorCourses}
          >
            <FaBookOpen />
            <span>My Courses</span>
          </button>

          <button
            type="button"
            onClick={openTutorAssessments}
          >
            <FaClipboardCheck />
            <span>Assessments</span>
          </button>

          <button
            type="button"
            onClick={openTutorStudents}
          >
            <FaUserGraduate />
            <span>Students</span>
          </button>

          <button
            type="button"
            onClick={openTutorCommunication}
          >
            <FaBullhorn />
            <span>Communication</span>
          </button>

          <button
            type="button"
            onClick={openTutorSessions}
          >
            <FaCalendarAlt />
            <span>Sessions</span>
          </button>

          <button
            type="button"
            onClick={openTutorAnalytics}
          >
            <FaChartLine />
            <span>Analytics</span>
          </button>
        </nav>

        <button
          type="button"
          className="tutor-logout"
          onClick={handleLogout}
        >
          <FaSignOutAlt />
          <span>Log out</span>
        </button>
      </aside>

      <div className="tutor-main">
        <header className="tutor-header">
          <div>
            <p className="tutor-eyebrow">
              TUTOR DASHBOARD
            </p>

            <h1>
              Welcome,{" "}
              {user?.name?.split(" ")[0] || "Tutor"}
            </h1>

            <p>
              Manage your teaching content and assigned
              students.
            </p>
          </div>

          <div className="tutor-header-actions">
            <MessageBox />

            <button
              type="button"
              className="tutor-primary-button"
              onClick={() =>
                navigate("/tutor-courses/new")
              }
            >
              Create Course
            </button>
          </div>
        </header>

        <section
          className="tutor-statistics"
          aria-label="Tutor statistics"
        >
          {statistics.map((statistic) => {
            const Icon = statistic.icon;

            return (
              <article
                className={`tutor-stat-card ${statistic.color}`}
                key={statistic.id}
              >
                <div className="tutor-stat-icon">
                  <Icon />
                </div>

                <div>
                  <h2>{statistic.value}</h2>
                  <p>{statistic.label}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="tutor-dashboard-grid">
          <article className="tutor-panel">
            <div className="tutor-panel-header">
              <div>
                <h2>Assigned Courses</h2>
                <p>Courses you currently manage</p>
              </div>

              <button
                type="button"
                className="tutor-text-button"
                onClick={openTutorCourses}
              >
                View all
              </button>
            </div>

            <div className="tutor-course-list">
              {courses.map((course) => (
                <div
                  className="tutor-course"
                  key={course.id}
                >
                  <div className="tutor-course-information">
                    <div className="tutor-course-title">
                      <h3>{course.title}</h3>

                      <span
                        className={
                          course.status === "Published"
                            ? "published"
                            : "pending"
                        }
                      >
                        {course.status}
                      </span>
                    </div>

                    <p>
                      {course.students} enrolled students
                    </p>

                    <div
                      className="tutor-progress"
                      aria-label={`${course.completion}% completion`}
                    >
                      <span
                        style={{
                          width: `${course.completion}%`,
                        }}
                      />
                    </div>

                    <small>
                      {course.completion}% average completion
                    </small>
                  </div>

                  <button
                    type="button"
                    className="tutor-secondary-button"
                    onClick={() =>
                      navigate(
                        `/tutor-courses/${course.id}/content`
                      )
                    }
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="tutor-panel">
            <div className="tutor-panel-header">
              <div>
                <h2>Upcoming</h2>
                <p>Lessons and deadlines</p>
              </div>
            </div>

            <div className="tutor-deadline-list">
              {deadlines.map((deadline) => (
                <div
                  className="tutor-deadline"
                  key={deadline.id}
                >
                  <div className="tutor-deadline-date">
                    {deadline.date}
                  </div>

                  <div>
                    <h3>{deadline.title}</h3>
                    <p>{deadline.course}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="tutor-full-button"
              onClick={openTutorSessions}
            >
              Schedule Learning Session
            </button>
          </article>
        </section>

        <section className="tutor-dashboard-grid">
          <article className="tutor-panel">
            <div className="tutor-panel-header">
              <div>
                <h2>Assessment Overview</h2>
                <p>Current grading activity</p>
              </div>

              <button
                type="button"
                className="tutor-text-button"
                onClick={openTutorAssessments}
              >
                Review submissions
              </button>
            </div>

            <div className="tutor-assessment-summary">
              <div>
                <strong>18</strong>
                <span>Waiting for grading</span>
              </div>

              <div>
                <strong>76%</strong>
                <span>Average score</span>
              </div>

              <div>
                <strong>9</strong>
                <span>Active assessments</span>
              </div>
            </div>
          </article>

          <article className="tutor-panel">
            <div className="tutor-panel-header">
              <div>
                <h2>Students Needing Support</h2>

                <p>
                  Students with low progress or scores
                </p>
              </div>
            </div>

            <div className="tutor-student-alert">
              <div className="tutor-student-avatar">
                MT
              </div>

              <div className="tutor-student-information">
                <h3>May Thu</h3>

                <p>
                  Python Basics · 32% completion
                </p>
              </div>

              <button
                type="button"
                className="tutor-secondary-button"
                onClick={openTutorStudents}
              >
                View
              </button>
            </div>

            <div className="tutor-student-alert">
              <div className="tutor-student-avatar">
                AM
              </div>

              <div className="tutor-student-information">
                <h3>Aung Min</h3>

                <p>
                  React Development · Quiz score 41%
                </p>
              </div>

              <button
                type="button"
                className="tutor-secondary-button"
                onClick={openTutorStudents}
              >
                View
              </button>
            </div>
          </article>
        </section>

        <section className="tutor-dashboard-grid">
          <article className="tutor-panel">
            <div className="tutor-panel-header">
              <div>
                <h2>Course Analytics</h2>

                <p>
                  Performance across your courses
                </p>
              </div>
            </div>

            <div className="tutor-analytics">
              <div>
                <span>Enrollment</span>
                <strong>+12%</strong>
              </div>

              <div>
                <span>Completion rate</span>
                <strong>68%</strong>
              </div>

              <div>
                <span>Average score</span>
                <strong>76%</strong>
              </div>

              <div>
                <span>Lesson engagement</span>
                <strong>81%</strong>
              </div>
            </div>
          </article>

          <article className="tutor-panel tutor-announcement-panel">
            <div className="tutor-panel-header">
              <div>
                <h2>Communication</h2>
                <p>Keep students informed</p>
              </div>
            </div>

            <textarea
              aria-label="Course announcement"
              placeholder="Write a course announcement..."
              rows="4"
            />

            <button
              type="button"
              className="tutor-primary-button"
              onClick={openTutorCommunication}
            >
              Post Announcement
            </button>
          </article>
        </section>
      </div>
    </main>
  );
}

export default TutorDashboard;

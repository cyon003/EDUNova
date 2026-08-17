import { useState } from "react";
import {
  FaArrowLeft,
  FaBookOpen,
  FaCheckCircle,
  FaClock,
  FaEdit,
  FaPlus,
  FaUsers,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import "../styles/TutorCourses.css";

const defaultTutorCourses = [
  {
    id: "1",
    title: "Python Basics",
    description:
      "Learn Python programming from the beginning.",
    category: "Programming",
    level: "Beginner",
    students: 48,
    modules: 6,
    status: "published",
    completion: 72,
  },
  {
    id: "2",
    title: "React Development",
    description:
      "Build modern user interfaces with React.",
    category: "Web Development",
    level: "Intermediate",
    students: 36,
    modules: 8,
    status: "published",
    completion: 64,
  },
  {
    id: "3",
    title: "Database Fundamentals",
    description:
      "Learn database concepts, MongoDB and data modeling.",
    category: "Database",
    level: "Beginner",
    students: 42,
    modules: 5,
    status: "pending",
    completion: 55,
  },
  {
    id: "4",
    title: "Advanced JavaScript",
    description:
      "Explore advanced JavaScript concepts and patterns.",
    category: "Programming",
    level: "Advanced",
    students: 0,
    modules: 3,
    status: "draft",
    completion: 0,
  },
];

function getSavedCourses() {
  try {
    const savedCourses = JSON.parse(
      localStorage.getItem(
        "edunova-tutor-course-drafts"
      )
    );

    return Array.isArray(savedCourses)
      ? savedCourses
      : [];
  } catch {
    return [];
  }
}

function getTutorCourses() {
  const savedCourses = getSavedCourses();

  const savedCourseIds = new Set(
    savedCourses.map((course) =>
      String(course.id)
    )
  );

  const updatedSavedCourses = savedCourses.map(
    (savedCourse) => {
      const originalCourse =
        defaultTutorCourses.find(
          (course) =>
            String(course.id) ===
            String(savedCourse.id)
        );

      return {
        ...originalCourse,
        ...savedCourse,
        id: String(savedCourse.id),
        students:
          savedCourse.students ??
          originalCourse?.students ??
          0,
        modules:
          savedCourse.modules ??
          originalCourse?.modules ??
          0,
        completion:
          savedCourse.completion ??
          originalCourse?.completion ??
          0,
      };
    }
  );

  const coursesNotEdited =
    defaultTutorCourses.filter(
      (course) =>
        !savedCourseIds.has(String(course.id))
    );

  return [
    ...updatedSavedCourses,
    ...coursesNotEdited,
  ];
}

function TutorCourses() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  const tutorCourses = getTutorCourses();

  const filteredCourses =
    filter === "all"
      ? tutorCourses
      : tutorCourses.filter(
          (course) => course.status === filter
        );

  const publishedCourses =
    tutorCourses.filter(
      (course) => course.status === "published"
    ).length;

  const pendingCourses =
    tutorCourses.filter(
      (course) => course.status === "pending"
    ).length;

  const totalStudents = tutorCourses.reduce(
    (total, course) =>
      total + Number(course.students || 0),
    0
  );

  const getStatusIcon = (status) => {
    if (status === "published") {
      return <FaCheckCircle />;
    }

    return <FaClock />;
  };

  const getStatusLabel = (status) => {
    if (!status) {
      return "Draft";
    }

    return status
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  return (
    <main className="tutor-courses-page">
      <header className="tutor-courses-header">
        <div>
          <button
            type="button"
            className="tutor-back-button"
            onClick={() =>
              navigate("/tutor-dashboard")
            }
          >
            <FaArrowLeft />
            Back to Dashboard
          </button>

          <p className="tutor-courses-eyebrow">
            COURSE MANAGEMENT
          </p>

          <h1>My Courses</h1>

          <p>
            Create, edit and organize the courses
            you teach.
          </p>
        </div>

        <button
          type="button"
          className="tutor-create-course-button"
          onClick={() =>
            navigate("/tutor-courses/new")
          }
        >
          <FaPlus />
          Create Course
        </button>
      </header>

      <section
        className="tutor-course-summary"
        aria-label="Course summary"
      >
        <article>
          <FaBookOpen />

          <div>
            <strong>{tutorCourses.length}</strong>
            <span>Total courses</span>
          </div>
        </article>

        <article>
          <FaCheckCircle />

          <div>
            <strong>{publishedCourses}</strong>
            <span>Published</span>
          </div>
        </article>

        <article>
          <FaClock />

          <div>
            <strong>{pendingCourses}</strong>
            <span>Pending approval</span>
          </div>
        </article>

        <article>
          <FaUsers />

          <div>
            <strong>{totalStudents}</strong>
            <span>Total students</span>
          </div>
        </article>
      </section>

      <section className="tutor-courses-list">
        <div className="tutor-courses-list-header">
          <div>
            <h2>Assigned Courses</h2>

            <p>
              You can manage only courses assigned
              to your account.
            </p>
          </div>

          <select
            aria-label="Filter courses"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
          >
            <option value="all">
              All courses
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="published">
              Published
            </option>
          </select>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="tutor-empty-courses">
            <FaBookOpen />

            <h3>No courses found</h3>

            <p>
              No courses match the selected filter.
            </p>

            <button
              type="button"
              className="tutor-create-course-button"
              onClick={() =>
                navigate("/tutor-courses/new")
              }
            >
              <FaPlus />
              Create Course
            </button>
          </div>
        ) : (
          <div className="tutor-course-card-grid">
            {filteredCourses.map((course) => (
              <article
                className="tutor-management-card"
                key={course.id}
              >
                <div className="tutor-course-card-top">
                  <div className="tutor-course-card-icon">
                    <FaBookOpen />
                  </div>

                  <span
                    className={`tutor-course-status ${
                      course.status || "draft"
                    }`}
                  >
                    {getStatusIcon(course.status)}

                    {getStatusLabel(
                      course.status
                    )}
                  </span>
                </div>

                <p className="tutor-course-category">
                  {course.category ||
                    "Uncategorized"}
                </p>

                <h2>{course.title}</h2>

                {course.description && (
                  <p className="tutor-course-description">
                    {course.description}
                  </p>
                )}

                <div className="tutor-course-details">
                  <span>
                    <FaUsers />
                    {course.students || 0} students
                  </span>

                  <span>
                    <FaBookOpen />
                    {course.modules || 0} modules
                  </span>
                </div>

                <div className="tutor-course-progress">
                  <div>
                    <span>
                      Average completion
                    </span>

                    <strong>
                      {course.completion || 0}%
                    </strong>
                  </div>

                  <div className="tutor-course-progress-bar">
                    <span
                      style={{
                        width: `${
                          course.completion || 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="tutor-course-actions">
                  <button
                    type="button"
                    className="tutor-edit-course-button"
                    onClick={() =>
                      navigate(
                        `/tutor-courses/${course.id}/edit`
                      )
                    }
                  >
                    <FaEdit />
                    Edit
                  </button>

                  <button
                    type="button"
                    className="tutor-manage-course-button"
                    onClick={() =>
                      navigate(
                        `/tutor-courses/${course.id}/content`
                      )
                    }
                  >
                    Manage Content
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default TutorCourses;
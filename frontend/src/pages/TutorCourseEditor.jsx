import { useState } from "react";
import {
    FaArrowLeft,
    FaCheckCircle,
    FaSave,
} from "react-icons/fa";
import {
    useNavigate,
    useParams,
} from "react-router-dom";

import "../styles/TutorCourseEditor.css";

const existingCourses = {
  1: {
    title: "Python Basics",
    description:
      "Learn Python programming from the beginning.",
    category: "Programming",
    level: "Beginner",
    thumbnail: "",
    objectives:
      "Understand Python syntax\nCreate functions\nWork with lists and objects",
  },
  2: {
    title: "React Development",
    description:
      "Build modern user interfaces with React.",
    category: "Web Development",
    level: "Intermediate",
    thumbnail: "",
    objectives:
      "Understand React components\nManage state\nBuild interactive applications",
  },
  3: {
    title: "Database Fundamentals",
    description:
      "Learn database concepts, MongoDB and data modeling.",
    category: "Database",
    level: "Beginner",
    thumbnail: "",
    objectives:
      "Understand databases\nCreate MongoDB collections\nDesign data models",
  },
};

function getSavedCourses() {
  try {
    return JSON.parse(
      localStorage.getItem("edunova-tutor-course-drafts")
    ) || [];
  } catch {
    return [];
  }
}

function TutorCourseEditor() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isEditing = Boolean(courseId);

  const savedCourses = getSavedCourses();

  const savedCourse = savedCourses.find(
    (course) => String(course.id) === String(courseId)
  );

  const originalCourse =
    savedCourse || existingCourses[courseId] || {};

  const [formData, setFormData] = useState({
    title: originalCourse.title || "",
    description: originalCourse.description || "",
    category: originalCourse.category || "",
    level: originalCourse.level || "Beginner",
    thumbnail: originalCourse.thumbnail || "",
    objectives: originalCourse.objectives || "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setMessage("");
  };

  const saveCourse = (status) => {
    if (
      !formData.title.trim() ||
      !formData.description.trim() ||
      !formData.category.trim()
    ) {
      setMessage(
        "Title, description and category are required."
      );

      return;
    }

    const currentCourses = getSavedCourses();

    const savedCourseData = {
      id: courseId || String(Date.now()),
      ...formData,
      status,
      updatedAt: new Date().toISOString(),
    };

    const courseAlreadyExists = currentCourses.some(
      (course) =>
        String(course.id) ===
        String(savedCourseData.id)
    );

    const updatedCourses = courseAlreadyExists
      ? currentCourses.map((course) =>
          String(course.id) ===
          String(savedCourseData.id)
            ? savedCourseData
            : course
        )
      : [savedCourseData, ...currentCourses];

    localStorage.setItem(
      "edunova-tutor-course-drafts",
      JSON.stringify(updatedCourses)
    );

    if (status === "pending") {
      setMessage(
        "Course submitted for admin approval."
      );
    } else {
      setMessage("Course saved as a draft.");
    }
  };

  return (
    <main className="tutor-editor-page">
      <header className="tutor-editor-header">
        <div>
          <button
            type="button"
            className="tutor-editor-back"
            onClick={() => navigate("/tutor-courses")}
          >
            <FaArrowLeft />
            Back to My Courses
          </button>

          <p>COURSE MANAGEMENT</p>

          <h1>
            {isEditing
              ? "Edit Course"
              : "Create Course"}
          </h1>

          <span>
            Add the main information for your course.
          </span>
        </div>

        <div className="tutor-editor-actions">
          <button
            type="button"
            className="tutor-save-draft"
            onClick={() => saveCourse("draft")}
          >
            <FaSave />
            Save Draft
          </button>

          <button
            type="button"
            className="tutor-submit-course"
            onClick={() => saveCourse("pending")}
          >
            <FaCheckCircle />
            Submit for Approval
          </button>
        </div>
      </header>

      {message && (
        <div className="tutor-editor-message">
          {message}
        </div>
      )}

      <form
        className="tutor-course-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <section className="tutor-editor-panel">
          <div className="tutor-editor-panel-header">
            <h2>Basic Information</h2>

            <p>
              Introduce the course to your students.
            </p>
          </div>

          <div className="tutor-form-grid">
            <label className="tutor-full-field">
              <span>Course title *</span>

              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Example: Introduction to Python"
              />
            </label>

            <label className="tutor-full-field">
              <span>Description *</span>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe what students will learn"
                rows="5"
              />
            </label>

            <label>
              <span>Category *</span>

              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="Example: Programming"
              />
            </label>

            <label>
              <span>Difficulty level</span>

              <select
                name="level"
                value={formData.level}
                onChange={handleChange}
              >
                <option value="Beginner">
                  Beginner
                </option>

                <option value="Intermediate">
                  Intermediate
                </option>

                <option value="Advanced">
                  Advanced
                </option>
              </select>
            </label>

            <label className="tutor-full-field">
              <span>Thumbnail URL</span>

              <input
                type="url"
                name="thumbnail"
                value={formData.thumbnail}
                onChange={handleChange}
                placeholder="https://example.com/course-image.jpg"
              />
            </label>
          </div>
        </section>

        <section className="tutor-editor-panel">
          <div className="tutor-editor-panel-header">
            <h2>Learning Objectives</h2>

            <p>
              Add one objective on each line.
            </p>
          </div>

          <label className="tutor-objectives-field">
            <span>Students will be able to:</span>

            <textarea
              name="objectives"
              value={formData.objectives}
              onChange={handleChange}
              placeholder={
                "Understand the main concepts\nComplete practical exercises\nBuild a final project"
              }
              rows="8"
            />
          </label>

          {formData.objectives.trim() && (
            <div className="tutor-objective-preview">
              <h3>Objective Preview</h3>

              <ul>
                {formData.objectives
                  .split("\n")
                  .filter((objective) =>
                    objective.trim()
                  )
                  .map((objective, index) => (
                    <li key={`${objective}-${index}`}>
                      {objective}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      </form>

      <footer className="tutor-editor-footer">
        <button
          type="button"
          onClick={() => navigate("/tutor-courses")}
        >
          Cancel
        </button>

        <button
          type="button"
          className="tutor-save-draft"
          onClick={() => saveCourse("draft")}
        >
          <FaSave />
          Save Draft
        </button>

        <button
          type="button"
          className="tutor-submit-course"
          onClick={() => saveCourse("pending")}
        >
          <FaCheckCircle />
          Submit for Approval
        </button>
      </footer>
    </main>
  );
}

export default TutorCourseEditor;
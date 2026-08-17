import { useState } from "react";
import {
    FaArrowDown,
    FaArrowLeft,
    FaArrowUp,
    FaBookOpen,
    FaFileAlt,
    FaLink,
    FaPlus,
    FaSave,
    FaTrash,
    FaVideo,
} from "react-icons/fa";
import {
    useNavigate,
    useParams,
} from "react-router-dom";

import "../styles/TutorCourseContent.css";

const defaultCourseTitles = {
  1: "Python Basics",
  2: "React Development",
  3: "Database Fundamentals",
  4: "Advanced JavaScript",
};

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getSavedCourses() {
  try {
    const courses = JSON.parse(
      localStorage.getItem(
        "edunova-tutor-course-drafts"
      )
    );

    return Array.isArray(courses) ? courses : [];
  } catch {
    return [];
  }
}

function getSavedContent(courseId) {
  try {
    const content = JSON.parse(
      localStorage.getItem(
        `edunova-tutor-content-${courseId}`
      )
    );

    return content &&
      Array.isArray(content.modules)
      ? content.modules
      : [];
  } catch {
    return [];
  }
}

function createLesson() {
  return {
    id: createId("lesson"),
    title: "New Lesson",
    type: "text",
    content: "",
    videoUrl: "",
    documentUrl: "",
    resourceUrl: "",
    order: 1,
  };
}

function TutorCourseContent() {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const savedCourses = getSavedCourses();

  const savedCourse = savedCourses.find(
    (course) =>
      String(course.id) === String(courseId)
  );

  const courseTitle =
    savedCourse?.title ||
    defaultCourseTitles[courseId] ||
    "Course";

  const [modules, setModules] = useState(() =>
    getSavedContent(courseId)
  );

  const [message, setMessage] = useState("");

  const addModule = () => {
    const newModule = {
      id: createId("module"),
      title: `Module ${modules.length + 1}`,
      order: modules.length + 1,
      lessons: [],
    };

    setModules((current) => [
      ...current,
      newModule,
    ]);

    setMessage("");
  };

  const updateModuleTitle = (
    moduleId,
    title
  ) => {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              title,
            }
          : module
      )
    );

    setMessage("");
  };

  const removeModule = (moduleId) => {
    const shouldRemove = window.confirm(
      "Delete this module and all of its lessons?"
    );

    if (!shouldRemove) {
      return;
    }

    setModules((current) =>
      current
        .filter(
          (module) => module.id !== moduleId
        )
        .map((module, index) => ({
          ...module,
          order: index + 1,
        }))
    );

    setMessage("");
  };

  const moveModule = (
    moduleIndex,
    direction
  ) => {
    setModules((current) => {
      const targetIndex =
        moduleIndex + direction;

      if (
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current;
      }

      const updatedModules = [...current];

      [
        updatedModules[moduleIndex],
        updatedModules[targetIndex],
      ] = [
        updatedModules[targetIndex],
        updatedModules[moduleIndex],
      ];

      return updatedModules.map(
        (module, index) => ({
          ...module,
          order: index + 1,
        })
      );
    });

    setMessage("");
  };

  const addLesson = (moduleId) => {
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) {
          return module;
        }

        const lesson = {
          ...createLesson(),
          order: module.lessons.length + 1,
        };

        return {
          ...module,
          lessons: [
            ...module.lessons,
            lesson,
          ],
        };
      })
    );

    setMessage("");
  };

  const updateLesson = (
    moduleId,
    lessonId,
    field,
    value
  ) => {
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) {
          return module;
        }

        return {
          ...module,
          lessons: module.lessons.map(
            (lesson) =>
              lesson.id === lessonId
                ? {
                    ...lesson,
                    [field]: value,
                  }
                : lesson
          ),
        };
      })
    );

    setMessage("");
  };

  const removeLesson = (
    moduleId,
    lessonId
  ) => {
    const shouldRemove = window.confirm(
      "Delete this lesson?"
    );

    if (!shouldRemove) {
      return;
    }

    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) {
          return module;
        }

        return {
          ...module,
          lessons: module.lessons
            .filter(
              (lesson) =>
                lesson.id !== lessonId
            )
            .map((lesson, index) => ({
              ...lesson,
              order: index + 1,
            })),
        };
      })
    );

    setMessage("");
  };

  const moveLesson = (
    moduleId,
    lessonIndex,
    direction
  ) => {
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) {
          return module;
        }

        const targetIndex =
          lessonIndex + direction;

        if (
          targetIndex < 0 ||
          targetIndex >= module.lessons.length
        ) {
          return module;
        }

        const updatedLessons = [
          ...module.lessons,
        ];

        [
          updatedLessons[lessonIndex],
          updatedLessons[targetIndex],
        ] = [
          updatedLessons[targetIndex],
          updatedLessons[lessonIndex],
        ];

        return {
          ...module,
          lessons: updatedLessons.map(
            (lesson, index) => ({
              ...lesson,
              order: index + 1,
            })
          ),
        };
      })
    );

    setMessage("");
  };

  const saveContent = () => {
    const invalidModule = modules.some(
      (module) => !module.title.trim()
    );

    const invalidLesson = modules.some(
      (module) =>
        module.lessons.some(
          (lesson) => !lesson.title.trim()
        )
    );

    if (invalidModule) {
      setMessage(
        "Every module must have a title."
      );

      return;
    }

    if (invalidLesson) {
      setMessage(
        "Every lesson must have a title."
      );

      return;
    }

    const courseContent = {
      courseId,
      modules,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      `edunova-tutor-content-${courseId}`,
      JSON.stringify(courseContent)
    );

    setMessage(
      "Course content saved successfully."
    );
  };

  const getLessonIcon = (type) => {
    if (type === "video") {
      return <FaVideo />;
    }

    if (type === "document") {
      return <FaFileAlt />;
    }

    if (type === "resource") {
      return <FaLink />;
    }

    return <FaBookOpen />;
  };

  return (
    <main className="tutor-content-page">
      <header className="tutor-content-header">
        <div>
          <button
            type="button"
            className="tutor-content-back"
            onClick={() =>
              navigate("/tutor-courses")
            }
          >
            <FaArrowLeft />
            Back to My Courses
          </button>

          <p>COURSE CONTENT</p>

          <h1>{courseTitle}</h1>

          <span>
            Organize modules, lessons and learning
            resources.
          </span>
        </div>

        <div className="tutor-content-header-actions">
          <button
            type="button"
            className="tutor-add-module"
            onClick={addModule}
          >
            <FaPlus />
            Add Module
          </button>

          <button
            type="button"
            className="tutor-save-content"
            onClick={saveContent}
          >
            <FaSave />
            Save Content
          </button>
        </div>
      </header>

      {message && (
        <div className="tutor-content-message">
          {message}
        </div>
      )}

      {modules.length === 0 ? (
        <section className="tutor-content-empty">
          <FaBookOpen />

          <h2>No modules yet</h2>

          <p>
            Start building your course by adding its
            first module.
          </p>

          <button
            type="button"
            onClick={addModule}
          >
            <FaPlus />
            Add First Module
          </button>
        </section>
      ) : (
        <section className="tutor-module-list">
          {modules.map(
            (module, moduleIndex) => (
              <article
                className="tutor-module-card"
                key={module.id}
              >
                <header className="tutor-module-header">
                  <div className="tutor-module-number">
                    {moduleIndex + 1}
                  </div>

                  <input
                    type="text"
                    value={module.title}
                    onChange={(event) =>
                      updateModuleTitle(
                        module.id,
                        event.target.value
                      )
                    }
                    aria-label={`Module ${
                      moduleIndex + 1
                    } title`}
                  />

                  <div className="tutor-module-actions">
                    <button
                      type="button"
                      aria-label="Move module up"
                      disabled={moduleIndex === 0}
                      onClick={() =>
                        moveModule(
                          moduleIndex,
                          -1
                        )
                      }
                    >
                      <FaArrowUp />
                    </button>

                    <button
                      type="button"
                      aria-label="Move module down"
                      disabled={
                        moduleIndex ===
                        modules.length - 1
                      }
                      onClick={() =>
                        moveModule(
                          moduleIndex,
                          1
                        )
                      }
                    >
                      <FaArrowDown />
                    </button>

                    <button
                      type="button"
                      className="tutor-delete-content"
                      aria-label="Delete module"
                      onClick={() =>
                        removeModule(module.id)
                      }
                    >
                      <FaTrash />
                    </button>
                  </div>
                </header>

                <div className="tutor-lesson-list">
                  {module.lessons.length ===
                  0 ? (
                    <div className="tutor-lessons-empty">
                      No lessons in this module.
                    </div>
                  ) : (
                    module.lessons.map(
                      (
                        lesson,
                        lessonIndex
                      ) => (
                        <section
                          className="tutor-lesson-card"
                          key={lesson.id}
                        >
                          <header className="tutor-lesson-header">
                            <div className="tutor-lesson-icon">
                              {getLessonIcon(
                                lesson.type
                              )}
                            </div>

                            <div>
                              <strong>
                                Lesson{" "}
                                {lessonIndex + 1}
                              </strong>

                              <span>
                                {lesson.type}
                              </span>
                            </div>

                            <div className="tutor-lesson-actions">
                              <button
                                type="button"
                                aria-label="Move lesson up"
                                disabled={
                                  lessonIndex === 0
                                }
                                onClick={() =>
                                  moveLesson(
                                    module.id,
                                    lessonIndex,
                                    -1
                                  )
                                }
                              >
                                <FaArrowUp />
                              </button>

                              <button
                                type="button"
                                aria-label="Move lesson down"
                                disabled={
                                  lessonIndex ===
                                  module.lessons
                                    .length -
                                    1
                                }
                                onClick={() =>
                                  moveLesson(
                                    module.id,
                                    lessonIndex,
                                    1
                                  )
                                }
                              >
                                <FaArrowDown />
                              </button>

                              <button
                                type="button"
                                className="tutor-delete-content"
                                aria-label="Delete lesson"
                                onClick={() =>
                                  removeLesson(
                                    module.id,
                                    lesson.id
                                  )
                                }
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </header>

                          <div className="tutor-lesson-form">
                            <label>
                              <span>
                                Lesson title
                              </span>

                              <input
                                type="text"
                                value={
                                  lesson.title
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLesson(
                                    module.id,
                                    lesson.id,
                                    "title",
                                    event.target
                                      .value
                                  )
                                }
                              />
                            </label>

                            <label>
                              <span>
                                Lesson type
                              </span>

                              <select
                                value={lesson.type}
                                onChange={(
                                  event
                                ) =>
                                  updateLesson(
                                    module.id,
                                    lesson.id,
                                    "type",
                                    event.target
                                      .value
                                  )
                                }
                              >
                                <option value="text">
                                  Text lesson
                                </option>

                                <option value="video">
                                  Video
                                </option>

                                <option value="document">
                                  Document
                                </option>

                                <option value="resource">
                                  External resource
                                </option>
                              </select>
                            </label>

                            {lesson.type ===
                              "text" && (
                              <label className="tutor-lesson-full-field">
                                <span>
                                  Lesson content
                                </span>

                                <textarea
                                  value={
                                    lesson.content
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLesson(
                                      module.id,
                                      lesson.id,
                                      "content",
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="Write the lesson content..."
                                  rows="6"
                                />
                              </label>
                            )}

                            {lesson.type ===
                              "video" && (
                              <label className="tutor-lesson-full-field">
                                <span>
                                  Video URL
                                </span>

                                <input
                                  type="url"
                                  value={
                                    lesson.videoUrl
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLesson(
                                      module.id,
                                      lesson.id,
                                      "videoUrl",
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="https://youtube.com/..."
                                />
                              </label>
                            )}

                            {lesson.type ===
                              "document" && (
                              <label className="tutor-lesson-full-field">
                                <span>
                                  Document URL
                                </span>

                                <input
                                  type="url"
                                  value={
                                    lesson.documentUrl
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLesson(
                                      module.id,
                                      lesson.id,
                                      "documentUrl",
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="https://example.com/document.pdf"
                                />
                              </label>
                            )}

                            {lesson.type ===
                              "resource" && (
                              <label className="tutor-lesson-full-field">
                                <span>
                                  Resource URL
                                </span>

                                <input
                                  type="url"
                                  value={
                                    lesson.resourceUrl
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLesson(
                                      module.id,
                                      lesson.id,
                                      "resourceUrl",
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="https://example.com/resource"
                                />
                              </label>
                            )}
                          </div>
                        </section>
                      )
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="tutor-add-lesson"
                  onClick={() =>
                    addLesson(module.id)
                  }
                >
                  <FaPlus />
                  Add Lesson
                </button>
              </article>
            )
          )}
        </section>
      )}

      {modules.length > 0 && (
        <footer className="tutor-content-footer">
          <button
            type="button"
            onClick={() =>
              navigate("/tutor-courses")
            }
          >
            Back to Courses
          </button>

          <button
            type="button"
            className="tutor-save-content"
            onClick={saveContent}
          >
            <FaSave />
            Save Content
          </button>
        </footer>
      )}
    </main>
  );
}

export default TutorCourseContent;
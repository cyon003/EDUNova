import { useState } from "react";
import {
    FaArrowLeft,
    FaBookOpen,
    FaCheckCircle,
    FaClipboardCheck,
    FaClock,
    FaPlus,
    FaQuestionCircle,
    FaSave,
    FaTrash,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import "../styles/TutorAssessments.css";

const courseOptions = [
  {
    id: "1",
    title: "Python Basics",
  },
  {
    id: "2",
    title: "React Development",
  },
  {
    id: "3",
    title: "Database Fundamentals",
  },
];

const defaultAssessments = [
  {
    id: "assessment-1",
    title: "Python Functions Quiz",
    courseId: "1",
    course: "Python Basics",
    type: "Quiz",
    deadline: "2026-08-25",
    passingScore: 60,
    totalPoints: 100,
    submissions: 32,
    status: "Active",
    instructions:
      "Complete every question before the deadline.",
    questions: [],
  },
  {
    id: "assessment-2",
    title: "React Components Assignment",
    courseId: "2",
    course: "React Development",
    type: "Assignment",
    deadline: "2026-08-28",
    passingScore: 50,
    totalPoints: 100,
    submissions: 18,
    status: "Active",
    instructions:
      "Create a React application using reusable components.",
    questions: [],
  },
  {
    id: "assessment-3",
    title: "MongoDB Data Modeling",
    courseId: "3",
    course: "Database Fundamentals",
    type: "Assignment",
    deadline: "2026-09-02",
    passingScore: 60,
    totalPoints: 80,
    submissions: 0,
    status: "Draft",
    instructions:
      "Create a data model for the provided project.",
    questions: [],
  },
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createEmptyForm() {
  return {
    title: "",
    courseId: "1",
    type: "Quiz",
    deadline: "",
    passingScore: 60,
    totalPoints: 100,
    instructions: "",
    questions: [],
  };
}

function createQuestion() {
  return {
    id: createId("question"),
    text: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    points: 10,
  };
}

function getSavedAssessments() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        "edunova-tutor-assessments"
      )
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function TutorAssessments() {
  const navigate = useNavigate();

  const [
    savedAssessments,
    setSavedAssessments,
  ] = useState(getSavedAssessments);

  const [filter, setFilter] =
    useState("All");

  const [showForm, setShowForm] =
    useState(false);

  const [formData, setFormData] =
    useState(createEmptyForm);

  const [message, setMessage] =
    useState("");

  const assessments = [
    ...savedAssessments,
    ...defaultAssessments,
  ];

  const filteredAssessments =
    filter === "All"
      ? assessments
      : assessments.filter(
          (assessment) =>
            assessment.status === filter
        );

  const activeCount = assessments.filter(
    (assessment) =>
      assessment.status === "Active"
  ).length;

  const draftCount = assessments.filter(
    (assessment) =>
      assessment.status === "Draft"
  ).length;

  const totalSubmissions = assessments.reduce(
    (total, assessment) =>
      total +
      Number(assessment.submissions || 0),
    0
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setMessage("");
  };

  const addQuestion = () => {
    setFormData((current) => ({
      ...current,
      questions: [
        ...current.questions,
        createQuestion(),
      ],
    }));
  };

  const updateQuestion = (
    questionId,
    field,
    value
  ) => {
    setFormData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) =>
          question.id === questionId
            ? {
                ...question,
                [field]: value,
              }
            : question
      ),
    }));
  };

  const updateQuestionOption = (
    questionId,
    optionIndex,
    value
  ) => {
    setFormData((current) => ({
      ...current,
      questions: current.questions.map(
        (question) => {
          if (
            question.id !== questionId
          ) {
            return question;
          }

          const updatedOptions = [
            ...question.options,
          ];

          updatedOptions[optionIndex] =
            value;

          return {
            ...question,
            options: updatedOptions,
          };
        }
      ),
    }));
  };

  const removeQuestion = (questionId) => {
    setFormData((current) => ({
      ...current,
      questions:
        current.questions.filter(
          (question) =>
            question.id !== questionId
        ),
    }));
  };

  const saveAssessment = (status) => {
    if (
      !formData.title.trim() ||
      !formData.deadline
    ) {
      setMessage(
        "Assessment title and deadline are required."
      );

      return;
    }

    const passingScore = Number(
      formData.passingScore
    );

    const totalPoints = Number(
      formData.totalPoints
    );

    if (
      passingScore < 0 ||
      passingScore > 100
    ) {
      setMessage(
        "Passing score must be between 0 and 100."
      );

      return;
    }

    if (totalPoints < 1) {
      setMessage(
        "Total points must be at least 1."
      );

      return;
    }

    if (
      formData.type === "Quiz" &&
      formData.questions.length === 0
    ) {
      setMessage(
        "Add at least one question to the quiz."
      );

      return;
    }

    if (formData.type === "Quiz") {
      const hasIncompleteQuestion =
        formData.questions.some(
          (question) =>
            !question.text.trim() ||
            question.options.some(
              (option) => !option.trim()
            )
        );

      if (hasIncompleteQuestion) {
        setMessage(
          "Complete every question and answer option."
        );

        return;
      }
    }

    const selectedCourse =
      courseOptions.find(
        (course) =>
          course.id === formData.courseId
      );

    const assessment = {
      id: createId("assessment"),
      ...formData,
      course:
        selectedCourse?.title || "Course",
      passingScore,
      totalPoints,
      submissions: 0,
      status,
      createdAt:
        new Date().toISOString(),
    };

    const updatedAssessments = [
      assessment,
      ...savedAssessments,
    ];

    setSavedAssessments(
      updatedAssessments
    );

    localStorage.setItem(
      "edunova-tutor-assessments",
      JSON.stringify(updatedAssessments)
    );

    setFormData(createEmptyForm());
    setShowForm(false);

    setMessage(
      status === "Active"
        ? "Assessment published successfully."
        : "Assessment saved as a draft."
    );
  };

  const deleteAssessment = (
    assessmentId
  ) => {
    const shouldDelete = window.confirm(
      "Delete this assessment?"
    );

    if (!shouldDelete) {
      return;
    }

    const updatedAssessments =
      savedAssessments.filter(
        (assessment) =>
          assessment.id !== assessmentId
      );

    setSavedAssessments(
      updatedAssessments
    );

    localStorage.setItem(
      "edunova-tutor-assessments",
      JSON.stringify(updatedAssessments)
    );

    setMessage("Assessment deleted.");
  };

  const formatDate = (date) => {
    if (!date) {
      return "No deadline";
    }

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString();
  };

  return (
    <main className="tutor-assessments-page">
      <header className="tutor-assessments-header">
        <div>
          <button
            type="button"
            className="tutor-assessments-back"
            onClick={() =>
              navigate("/tutor-dashboard")
            }
          >
            <FaArrowLeft />
            Back to Dashboard
          </button>

          <p className="tutor-assessments-eyebrow">
            ASSESSMENTS
          </p>

          <h1>
            Quizzes & Assignments
          </h1>

          <span>
            Create assessments, set deadlines and
            review student work.
          </span>
        </div>

        <button
          type="button"
          className="tutor-create-assessment"
          onClick={() => {
            setShowForm(true);
            setMessage("");
          }}
        >
          <FaPlus />
          Create Assessment
        </button>
      </header>

      {message && (
        <div className="tutor-assessment-message">
          {message}
        </div>
      )}

      <section
        className="tutor-assessment-summary"
        aria-label="Assessment summary"
      >
        <article>
          <FaClipboardCheck />

          <div>
            <strong>
              {assessments.length}
            </strong>
            <span>Total assessments</span>
          </div>
        </article>

        <article>
          <FaCheckCircle />

          <div>
            <strong>{activeCount}</strong>
            <span>Active</span>
          </div>
        </article>

        <article>
          <FaClock />

          <div>
            <strong>{draftCount}</strong>
            <span>Drafts</span>
          </div>
        </article>

        <article>
          <FaBookOpen />

          <div>
            <strong>
              {totalSubmissions}
            </strong>
            <span>Total submissions</span>
          </div>
        </article>
      </section>

      {showForm && (
        <section className="tutor-assessment-form-panel">
          <div className="tutor-assessment-form-header">
            <div>
              <h2>Create Assessment</h2>

              <p>
                Add quiz or assignment details.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormData(
                  createEmptyForm()
                );
                setMessage("");
              }}
            >
              Cancel
            </button>
          </div>

          <form
            className="tutor-assessment-form"
            onSubmit={(event) =>
              event.preventDefault()
            }
          >
            <label className="tutor-assessment-full-field">
              <span>
                Assessment title *
              </span>

              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Example: Python Functions Quiz"
              />
            </label>

            <label>
              <span>Course</span>

              <select
                name="courseId"
                value={formData.courseId}
                onChange={handleChange}
              >
                {courseOptions.map(
                  (course) => (
                    <option
                      value={course.id}
                      key={course.id}
                    >
                      {course.title}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>
                Assessment type
              </span>

              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="Quiz">
                  Quiz
                </option>

                <option value="Assignment">
                  Assignment
                </option>
              </select>
            </label>

            <label>
              <span>Deadline *</span>

              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
              />
            </label>

            <label>
              <span>Total points</span>

              <input
                type="number"
                name="totalPoints"
                min="1"
                value={
                  formData.totalPoints
                }
                onChange={handleChange}
              />
            </label>

            <label>
              <span>
                Passing score (%)
              </span>

              <input
                type="number"
                name="passingScore"
                min="0"
                max="100"
                value={
                  formData.passingScore
                }
                onChange={handleChange}
              />
            </label>

            <label className="tutor-assessment-full-field">
              <span>Instructions</span>

              <textarea
                name="instructions"
                value={
                  formData.instructions
                }
                onChange={handleChange}
                placeholder="Add instructions for students..."
                rows="5"
              />
            </label>
          </form>

          {formData.type === "Quiz" && (
            <section className="tutor-question-builder">
              <div className="tutor-question-builder-header">
                <div>
                  <h3>Quiz Questions</h3>

                  <p>
                    Add questions and select the
                    correct answers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addQuestion}
                >
                  <FaPlus />
                  Add Question
                </button>
              </div>

              {formData.questions.length ===
              0 ? (
                <div className="tutor-no-questions">
                  <FaQuestionCircle />

                  <p>
                    No quiz questions added yet.
                  </p>
                </div>
              ) : (
                <div className="tutor-question-list">
                  {formData.questions.map(
                    (question, index) => (
                      <article
                        className="tutor-question-card"
                        key={question.id}
                      >
                        <header>
                          <strong>
                            Question {index + 1}
                          </strong>

                          <button
                            type="button"
                            aria-label="Delete question"
                            onClick={() =>
                              removeQuestion(
                                question.id
                              )
                            }
                          >
                            <FaTrash />
                          </button>
                        </header>

                        <label>
                          <span>
                            Question text
                          </span>

                          <input
                            type="text"
                            value={
                              question.text
                            }
                            onChange={(event) =>
                              updateQuestion(
                                question.id,
                                "text",
                                event.target
                                  .value
                              )
                            }
                            placeholder="Enter the question"
                          />
                        </label>

                        <div className="tutor-question-options">
                          {question.options.map(
                            (
                              option,
                              optionIndex
                            ) => (
                              <label
                                key={`${question.id}-${optionIndex}`}
                              >
                                <span>
                                  Option{" "}
                                  {optionIndex +
                                    1}
                                </span>

                                <input
                                  type="text"
                                  value={option}
                                  onChange={(
                                    event
                                  ) =>
                                    updateQuestionOption(
                                      question.id,
                                      optionIndex,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </label>
                            )
                          )}
                        </div>

                        <div className="tutor-question-settings">
                          <label>
                            <span>
                              Correct answer
                            </span>

                            <select
                              value={
                                question.correctAnswer
                              }
                              onChange={(event) =>
                                updateQuestion(
                                  question.id,
                                  "correctAnswer",
                                  Number(
                                    event.target
                                      .value
                                  )
                                )
                              }
                            >
                              {question.options.map(
                                (
                                  option,
                                  optionIndex
                                ) => (
                                  <option
                                    value={
                                      optionIndex
                                    }
                                    key={`${question.id}-correct-${optionIndex}`}
                                  >
                                    Option{" "}
                                    {optionIndex +
                                      1}
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          <label>
                            <span>Points</span>

                            <input
                              type="number"
                              min="1"
                              value={
                                question.points
                              }
                              onChange={(event) =>
                                updateQuestion(
                                  question.id,
                                  "points",
                                  Number(
                                    event.target
                                      .value
                                  )
                                )
                              }
                            />
                          </label>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          <footer className="tutor-assessment-form-actions">
            <button
              type="button"
              className="tutor-assessment-draft"
              onClick={() =>
                saveAssessment("Draft")
              }
            >
              <FaSave />
              Save Draft
            </button>

            <button
              type="button"
              className="tutor-assessment-publish"
              onClick={() =>
                saveAssessment("Active")
              }
            >
              <FaCheckCircle />
              Publish Assessment
            </button>
          </footer>
        </section>
      )}

      <section className="tutor-assessment-list-panel">
        <div className="tutor-assessment-list-header">
          <div>
            <h2>Course Assessments</h2>

            <p>
              Manage quizzes and assignments for
              your courses.
            </p>
          </div>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
            aria-label="Filter assessments"
          >
            <option value="All">
              All assessments
            </option>

            <option value="Active">
              Active
            </option>

            <option value="Draft">
              Draft
            </option>
          </select>
        </div>

        <div className="tutor-assessment-card-grid">
          {filteredAssessments.map(
            (assessment) => {
              const isSavedAssessment =
                savedAssessments.some(
                  (savedAssessment) =>
                    savedAssessment.id ===
                    assessment.id
                );

              return (
                <article
                  className="tutor-assessment-card"
                  key={assessment.id}
                >
                  <div className="tutor-assessment-card-top">
                    <span className="tutor-assessment-type">
                      {assessment.type}
                    </span>

                    <span
                      className={`tutor-assessment-status ${assessment.status.toLowerCase()}`}
                    >
                      {assessment.status}
                    </span>
                  </div>

                  <p className="tutor-assessment-course">
                    {assessment.course}
                  </p>

                  <h2>
                    {assessment.title}
                  </h2>

                  <div className="tutor-assessment-details">
                    <span>
                      Deadline

                      <strong>
                        {formatDate(
                          assessment.deadline
                        )}
                      </strong>
                    </span>

                    <span>
                      Passing score

                      <strong>
                        {
                          assessment.passingScore
                        }
                        %
                      </strong>
                    </span>

                    <span>
                      Total points

                      <strong>
                        {
                          assessment.totalPoints
                        }
                      </strong>
                    </span>

                    <span>
                      Submissions

                      <strong>
                        {
                          assessment.submissions
                        }
                      </strong>
                    </span>
                  </div>

                  <div className="tutor-assessment-card-actions">
                    <button
                      type="button"
                      className="tutor-review-submissions"
                      onClick={() =>
                        navigate(
                          `/tutor-assessments/${assessment.id}/submissions`
                        )
                      }
                    >
                      Review Submissions
                    </button>

                    {isSavedAssessment && (
                      <button
                        type="button"
                        className="tutor-delete-assessment"
                        aria-label="Delete assessment"
                        onClick={() =>
                          deleteAssessment(
                            assessment.id
                          )
                        }
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </article>
              );
            }
          )}
        </div>
      </section>
    </main>
  );
}

export default TutorAssessments;

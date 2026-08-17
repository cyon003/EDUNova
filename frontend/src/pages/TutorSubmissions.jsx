import { useState } from "react";
import {
    FaArrowLeft,
    FaCheckCircle,
    FaClock,
    FaExternalLinkAlt,
    FaSave,
    FaTimesCircle,
    FaUserGraduate,
} from "react-icons/fa";
import {
    useNavigate,
    useParams,
} from "react-router-dom";

import "../styles/TutorSubmissions.css";

const defaultAssessments = {
  "assessment-1": {
    title: "Python Functions Quiz",
    course: "Python Basics",
    type: "Quiz",
    totalPoints: 100,
    passingScore: 60,
  },
  "assessment-2": {
    title: "React Components Assignment",
    course: "React Development",
    type: "Assignment",
    totalPoints: 100,
    passingScore: 50,
  },
  "assessment-3": {
    title: "MongoDB Data Modeling",
    course: "Database Fundamentals",
    type: "Assignment",
    totalPoints: 80,
    passingScore: 60,
  },
};

const submissionTemplates = [
  {
    id: "submission-1",
    studentName: "May Thu",
    studentEmail: "maythu@example.com",
    submittedAt: "2026-08-20T10:30:00",
    status: "Pending",
    answer:
      "A Python function is a reusable block of code defined using the def keyword.",
    assignmentUrl: "",
    score: "",
    feedback: "",
    result: "",
  },
  {
    id: "submission-2",
    studentName: "Aung Min",
    studentEmail: "aungmin@example.com",
    submittedAt: "2026-08-21T14:45:00",
    status: "Pending",
    answer:
      "Functions can accept parameters and return values to other parts of a program.",
    assignmentUrl:
      "https://github.com/example/student-project",
    score: "",
    feedback: "",
    result: "",
  },
  {
    id: "submission-3",
    studentName: "Su Su",
    studentEmail: "susu@example.com",
    submittedAt: "2026-08-22T09:15:00",
    status: "Graded",
    answer:
      "The return statement sends a result back to the code that called the function.",
    assignmentUrl: "",
    score: 82,
    feedback:
      "Good explanation and clear examples.",
    result: "Passed",
  },
];

function getSavedAssessments() {
  try {
    const assessments = JSON.parse(
      localStorage.getItem(
        "edunova-tutor-assessments"
      )
    );

    return Array.isArray(assessments)
      ? assessments
      : [];
  } catch {
    return [];
  }
}

function getAssessment(assessmentId) {
  const savedAssessment =
    getSavedAssessments().find(
      (assessment) =>
        String(assessment.id) ===
        String(assessmentId)
    );

  if (savedAssessment) {
    return {
      title: savedAssessment.title,
      course:
        savedAssessment.course || "Course",
      type: savedAssessment.type,
      totalPoints: Number(
        savedAssessment.totalPoints || 100
      ),
      passingScore: Number(
        savedAssessment.passingScore || 0
      ),
    };
  }

  return (
    defaultAssessments[assessmentId] || {
      title: "Assessment",
      course: "Course",
      type: "Assignment",
      totalPoints: 100,
      passingScore: 60,
    }
  );
}

function getInitialSubmissions(
  assessmentId
) {
  try {
    const savedSubmissions = JSON.parse(
      localStorage.getItem(
        `edunova-tutor-submissions-${assessmentId}`
      )
    );

    if (Array.isArray(savedSubmissions)) {
      return savedSubmissions;
    }
  } catch {
    // Use sample submissions.
  }

  return submissionTemplates.map(
    (submission) => ({
      ...submission,
      id: `${assessmentId}-${submission.id}`,
    })
  );
}

function TutorSubmissions() {
  const navigate = useNavigate();

  const { assessmentId } = useParams();

  const assessment =
    getAssessment(assessmentId);

  const [submissions, setSubmissions] =
    useState(() =>
      getInitialSubmissions(assessmentId)
    );

  const [selectedSubmissionId, setSelectedSubmissionId] =
    useState(
      () =>
        getInitialSubmissions(
          assessmentId
        )[0]?.id || null
    );

  const [filter, setFilter] =
    useState("All");

  const [message, setMessage] =
    useState("");

  const filteredSubmissions =
    filter === "All"
      ? submissions
      : submissions.filter(
          (submission) =>
            submission.status === filter
        );

  const selectedSubmission =
    submissions.find(
      (submission) =>
        submission.id ===
        selectedSubmissionId
    );

  const pendingCount = submissions.filter(
    (submission) =>
      submission.status === "Pending"
  ).length;

  const gradedCount = submissions.filter(
    (submission) =>
      submission.status === "Graded"
  ).length;

  const updateSelectedSubmission = (
    field,
    value
  ) => {
    setSubmissions((current) =>
      current.map((submission) =>
        submission.id ===
        selectedSubmissionId
          ? {
              ...submission,
              [field]: value,
            }
          : submission
      )
    );

    setMessage("");
  };

  const saveGrade = () => {
    if (!selectedSubmission) {
      return;
    }

    if (
      selectedSubmission.score === "" ||
      selectedSubmission.score === null
    ) {
      setMessage(
        "Enter a score before saving the grade."
      );

      return;
    }

    const score = Number(
      selectedSubmission.score
    );

    if (
      Number.isNaN(score) ||
      score < 0 ||
      score > assessment.totalPoints
    ) {
      setMessage(
        `Score must be between 0 and ${assessment.totalPoints}.`
      );

      return;
    }

    const percentage =
      (score / assessment.totalPoints) *
      100;

    const result =
      percentage >=
      assessment.passingScore
        ? "Passed"
        : "Failed";

    const updatedSubmissions =
      submissions.map((submission) =>
        submission.id ===
        selectedSubmissionId
          ? {
              ...submission,
              score,
              status: "Graded",
              result,
              gradedAt:
                new Date().toISOString(),
            }
          : submission
      );

    setSubmissions(updatedSubmissions);

    localStorage.setItem(
      `edunova-tutor-submissions-${assessmentId}`,
      JSON.stringify(updatedSubmissions)
    );

    setMessage(
      `Grade saved. Student result: ${result}.`
    );
  };

  const formatDate = (date) =>
    new Date(date).toLocaleString();

  return (
    <main className="tutor-submissions-page">
      <header className="tutor-submissions-header">
        <div>
          <button
            type="button"
            className="tutor-submissions-back"
            onClick={() =>
              navigate("/tutor-assessments")
            }
          >
            <FaArrowLeft />
            Back to Assessments
          </button>

          <p>SUBMISSION REVIEW</p>

          <h1>{assessment.title}</h1>

          <span>
            {assessment.course} ·{" "}
            {assessment.type}
          </span>
        </div>

        <div className="tutor-submission-requirements">
          <div>
            <span>Total points</span>
            <strong>
              {assessment.totalPoints}
            </strong>
          </div>

          <div>
            <span>Passing score</span>
            <strong>
              {assessment.passingScore}%
            </strong>
          </div>
        </div>
      </header>

      {message && (
        <div className="tutor-submission-message">
          {message}
        </div>
      )}

      <section className="tutor-submission-summary">
        <article>
          <FaUserGraduate />

          <div>
            <strong>
              {submissions.length}
            </strong>
            <span>Total submissions</span>
          </div>
        </article>

        <article>
          <FaClock />

          <div>
            <strong>{pendingCount}</strong>
            <span>Waiting for grading</span>
          </div>
        </article>

        <article>
          <FaCheckCircle />

          <div>
            <strong>{gradedCount}</strong>
            <span>Graded</span>
          </div>
        </article>
      </section>

      <section className="tutor-submission-workspace">
        <aside className="tutor-submission-list">
          <div className="tutor-submission-list-header">
            <div>
              <h2>Students</h2>
              <p>Select a submission.</p>
            </div>

            <select
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value
                )
              }
            >
              <option value="All">
                All
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Graded">
                Graded
              </option>
            </select>
          </div>

          {filteredSubmissions.length ===
          0 ? (
            <div className="tutor-no-submissions">
              No submissions match this filter.
            </div>
          ) : (
            filteredSubmissions.map(
              (submission) => (
                <button
                  type="button"
                  className={
                    submission.id ===
                    selectedSubmissionId
                      ? "tutor-submission-item active"
                      : "tutor-submission-item"
                  }
                  onClick={() => {
                    setSelectedSubmissionId(
                      submission.id
                    );
                    setMessage("");
                  }}
                  key={submission.id}
                >
                  <div className="tutor-submission-avatar">
                    {submission.studentName
                      .split(" ")
                      .map((name) => name[0])
                      .join("")
                      .slice(0, 2)}
                  </div>

                  <div>
                    <strong>
                      {
                        submission.studentName
                      }
                    </strong>

                    <span>
                      {formatDate(
                        submission.submittedAt
                      )}
                    </span>
                  </div>

                  <span
                    className={`tutor-submission-status ${submission.status.toLowerCase()}`}
                  >
                    {submission.status}
                  </span>
                </button>
              )
            )
          )}
        </aside>

        <article className="tutor-submission-detail">
          {!selectedSubmission ? (
            <div className="tutor-select-submission">
              Select a student submission.
            </div>
          ) : (
            <>
              <header className="tutor-submission-student">
                <div className="tutor-submission-avatar large">
                  {selectedSubmission.studentName
                    .split(" ")
                    .map((name) => name[0])
                    .join("")
                    .slice(0, 2)}
                </div>

                <div>
                  <h2>
                    {
                      selectedSubmission.studentName
                    }
                  </h2>

                  <p>
                    {
                      selectedSubmission.studentEmail
                    }
                  </p>

                  <span>
                    Submitted{" "}
                    {formatDate(
                      selectedSubmission.submittedAt
                    )}
                  </span>
                </div>

                {selectedSubmission.result && (
                  <strong
                    className={`tutor-result ${selectedSubmission.result.toLowerCase()}`}
                  >
                    {selectedSubmission.result ===
                    "Passed" ? (
                      <FaCheckCircle />
                    ) : (
                      <FaTimesCircle />
                    )}

                    {
                      selectedSubmission.result
                    }
                  </strong>
                )}
              </header>

              <section className="tutor-submitted-work">
                <h3>Student Work</h3>

                <div className="tutor-student-answer">
                  <p>
                    {selectedSubmission.answer ||
                      "No written answer was provided."}
                  </p>
                </div>

                {selectedSubmission.assignmentUrl && (
                  <a
                    href={
                      selectedSubmission.assignmentUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FaExternalLinkAlt />
                    Open submitted project
                  </a>
                )}
              </section>

              <section className="tutor-grading-form">
                <h3>Grade & Feedback</h3>

                <div className="tutor-grade-fields">
                  <label>
                    <span>
                      Score out of{" "}
                      {
                        assessment.totalPoints
                      }
                    </span>

                    <input
                      type="number"
                      min="0"
                      max={
                        assessment.totalPoints
                      }
                      value={
                        selectedSubmission.score
                      }
                      onChange={(event) =>
                        updateSelectedSubmission(
                          "score",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Passing requirement
                    </span>

                    <input
                      type="text"
                      value={`${assessment.passingScore}%`}
                      disabled
                    />
                  </label>
                </div>

                <label className="tutor-feedback-field">
                  <span>
                    Written feedback
                  </span>

                  <textarea
                    value={
                      selectedSubmission.feedback
                    }
                    onChange={(event) =>
                      updateSelectedSubmission(
                        "feedback",
                        event.target.value
                      )
                    }
                    placeholder="Give helpful feedback to the student..."
                    rows="6"
                  />
                </label>

                <button
                  type="button"
                  className="tutor-save-grade"
                  onClick={saveGrade}
                >
                  <FaSave />
                  Save Grade
                </button>
              </section>
            </>
          )}
        </article>
      </section>
    </main>
  );
}

export default TutorSubmissions;
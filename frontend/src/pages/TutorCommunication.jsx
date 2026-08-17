import { useState } from "react";
import {
  FaArrowLeft,
  FaBullhorn,
  FaCheckCircle,
  FaComments,
  FaPaperPlane,
  FaQuestionCircle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import "../styles/TutorCommunication.css";

const courses = [
  "Python Basics",
  "React Development",
  "Database Fundamentals",
];

const initialQuestions = [
  {
    id: "question-1",
    student: "May Thu",
    course: "Python Basics",
    question:
      "Can you explain the difference between parameters and arguments?",
    answer: "",
    status: "Pending",
  },
  {
    id: "question-2",
    student: "Aung Min",
    course: "React Development",
    question: "When should I use props instead of component state?",
    answer: "",
    status: "Pending",
  },
  {
    id: "question-3",
    student: "Su Su",
    course: "Database Fundamentals",
    question: "Should every MongoDB document use the same fields?",
    answer:
      "Documents can have different fields, but a consistent structure usually makes the application easier to maintain.",
    status: "Answered",
  },
];

const initialDiscussions = [
  {
    id: "discussion-1",
    author: "May Thu",
    course: "Python Basics",
    message:
      "I found drawing a function flow diagram helpful before writing code.",
    date: "17 Aug 2026",
  },
  {
    id: "discussion-2",
    author: "Tutor",
    course: "React Development",
    message:
      "Remember to keep each component focused on one responsibility.",
    date: "17 Aug 2026",
  },
];

function getSavedData(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function TutorCommunication() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState(() =>
    getSavedData("edunova-tutor-announcements", [])
  );
  const [questions, setQuestions] = useState(() =>
    getSavedData("edunova-tutor-questions", initialQuestions)
  );
  const [discussions, setDiscussions] = useState(() =>
    getSavedData("edunova-tutor-discussions", initialDiscussions)
  );
  const [announcementCourse, setAnnouncementCourse] = useState(courses[0]);
  const [announcementText, setAnnouncementText] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    initialQuestions[0].id
  );
  const [replyText, setReplyText] = useState("");
  const [discussionCourse, setDiscussionCourse] = useState(courses[0]);
  const [discussionText, setDiscussionText] = useState("");
  const [message, setMessage] = useState("");

  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) ||
    questions[0];
  const pendingQuestions = questions.filter(
    (question) => question.status === "Pending"
  ).length;
  const answeredQuestions = questions.filter(
    (question) => question.status === "Answered"
  ).length;

  const postAnnouncement = () => {
    if (!announcementText.trim()) {
      setMessage("Please write an announcement first.");
      return;
    }

    const newAnnouncement = {
      id: `announcement-${Date.now()}`,
      course: announcementCourse,
      text: announcementText.trim(),
      date: new Date().toLocaleDateString(),
    };
    const updatedAnnouncements = [newAnnouncement, ...announcements];

    setAnnouncements(updatedAnnouncements);
    localStorage.setItem(
      "edunova-tutor-announcements",
      JSON.stringify(updatedAnnouncements)
    );
    setAnnouncementText("");
    setMessage("Announcement posted successfully.");
  };

  const answerQuestion = () => {
    if (!selectedQuestion || !replyText.trim()) {
      setMessage("Please write an answer first.");
      return;
    }

    const updatedQuestions = questions.map((question) =>
      question.id === selectedQuestion.id
        ? { ...question, answer: replyText.trim(), status: "Answered" }
        : question
    );

    setQuestions(updatedQuestions);
    localStorage.setItem(
      "edunova-tutor-questions",
      JSON.stringify(updatedQuestions)
    );
    setReplyText("");
    setMessage("Your answer was saved.");
  };

  const postDiscussion = () => {
    if (!discussionText.trim()) {
      setMessage("Please write a discussion message first.");
      return;
    }

    const newDiscussion = {
      id: `discussion-${Date.now()}`,
      author: "Tutor",
      course: discussionCourse,
      message: discussionText.trim(),
      date: new Date().toLocaleDateString(),
    };
    const updatedDiscussions = [newDiscussion, ...discussions];

    setDiscussions(updatedDiscussions);
    localStorage.setItem(
      "edunova-tutor-discussions",
      JSON.stringify(updatedDiscussions)
    );
    setDiscussionText("");
    setMessage("Discussion message posted.");
  };

  return (
    <main className="tutor-communication-page">
      <header className="tutor-communication-header">
        <button
          type="button"
          className="tutor-communication-back"
          onClick={() => navigate("/tutor-dashboard")}
        >
          <FaArrowLeft /> Back to Dashboard
        </button>
        <p>COMMUNICATION</p>
        <h1>Course Communication</h1>
        <span>
          Answer questions, post announcements and participate in course
          discussions.
        </span>
      </header>

      {message && (
        <div className="tutor-communication-message">
          <FaCheckCircle /> {message}
        </div>
      )}

      <section className="tutor-communication-summary">
        <article>
          <FaQuestionCircle />
          <div>
            <strong>{pendingQuestions}</strong>
            <span>Pending questions</span>
          </div>
        </article>
        <article>
          <FaCheckCircle />
          <div>
            <strong>{answeredQuestions}</strong>
            <span>Answered questions</span>
          </div>
        </article>
        <article>
          <FaBullhorn />
          <div>
            <strong>{announcements.length}</strong>
            <span>Announcements</span>
          </div>
        </article>
        <article>
          <FaComments />
          <div>
            <strong>{discussions.length}</strong>
            <span>Discussion posts</span>
          </div>
        </article>
      </section>

      <section className="tutor-communication-grid">
        <article className="tutor-communication-panel">
          <div className="tutor-communication-panel-heading">
            <FaBullhorn />
            <div>
              <h2>Course Announcements</h2>
              <p>Keep your students informed.</p>
            </div>
          </div>

          <label>
            <span>Course</span>
            <select
              value={announcementCourse}
              onChange={(event) => setAnnouncementCourse(event.target.value)}
            >
              {courses.map((course) => (
                <option value={course} key={course}>
                  {course}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Announcement</span>
            <textarea
              rows="5"
              value={announcementText}
              onChange={(event) => setAnnouncementText(event.target.value)}
              placeholder="Write a course announcement..."
            />
          </label>

          <button
            type="button"
            className="tutor-communication-primary"
            onClick={postAnnouncement}
          >
            <FaPaperPlane /> Post Announcement
          </button>

          <div className="tutor-announcement-list">
            {announcements.map((announcement) => (
              <div key={announcement.id}>
                <strong>{announcement.course}</strong>
                <p>{announcement.text}</p>
                <small>{announcement.date}</small>
              </div>
            ))}
            {announcements.length === 0 && (
              <p className="tutor-communication-empty">
                No announcements posted yet.
              </p>
            )}
          </div>
        </article>

        <article className="tutor-communication-panel">
          <div className="tutor-communication-panel-heading">
            <FaQuestionCircle />
            <div>
              <h2>Student Questions</h2>
              <p>Answer course-related questions.</p>
            </div>
          </div>

          <div className="tutor-question-list">
            {questions.map((question) => (
              <button
                type="button"
                className={
                  selectedQuestion?.id === question.id
                    ? "tutor-question-item active"
                    : "tutor-question-item"
                }
                onClick={() => {
                  setSelectedQuestionId(question.id);
                  setReplyText(question.answer || "");
                  setMessage("");
                }}
                key={question.id}
              >
                <span>
                  <strong>{question.student}</strong>
                  <small>{question.course}</small>
                </span>
                <em
                  className={
                    question.status === "Answered" ? "answered" : "pending"
                  }
                >
                  {question.status}
                </em>
              </button>
            ))}
          </div>

          {selectedQuestion && (
            <div className="tutor-question-reply">
              <h3>{selectedQuestion.student}</h3>
              <small>{selectedQuestion.course}</small>
              <p>{selectedQuestion.question}</p>
              <label>
                <span>Your answer</span>
                <textarea
                  rows="5"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Write a helpful answer..."
                />
              </label>
              <button
                type="button"
                className="tutor-communication-primary"
                onClick={answerQuestion}
              >
                <FaPaperPlane /> Save Answer
              </button>
            </div>
          )}
        </article>
      </section>

      <section className="tutor-communication-panel tutor-discussion-panel">
        <div className="tutor-communication-panel-heading">
          <FaComments />
          <div>
            <h2>Course Discussions</h2>
            <p>Participate in course conversations.</p>
          </div>
        </div>

        <div className="tutor-discussion-form">
          <select
            value={discussionCourse}
            onChange={(event) => setDiscussionCourse(event.target.value)}
          >
            {courses.map((course) => (
              <option value={course} key={course}>
                {course}
              </option>
            ))}
          </select>
          <textarea
            rows="3"
            value={discussionText}
            onChange={(event) => setDiscussionText(event.target.value)}
            placeholder="Write a discussion message..."
          />
          <button
            type="button"
            className="tutor-communication-primary"
            onClick={postDiscussion}
          >
            <FaPaperPlane /> Post Message
          </button>
        </div>

        <div className="tutor-discussion-list">
          {discussions.map((discussion) => (
            <article key={discussion.id}>
              <div>
                <strong>{discussion.author}</strong>
                <span>{discussion.course}</span>
              </div>
              <p>{discussion.message}</p>
              <small>{discussion.date}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default TutorCommunication;

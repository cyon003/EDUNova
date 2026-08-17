import { useState } from "react";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaClock,
  FaLink,
  FaPlus,
  FaTrash,
  FaUsers,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import "../styles/TutorSessions.css";

const assignedCourses = [
  "Python Basics",
  "React Development",
  "Database Fundamentals",
];

const defaultSessions = [
  {
    id: "session-1",
    title: "Python Functions Review",
    course: "Python Basics",
    date: "2026-08-20",
    startTime: "10:00",
    endTime: "11:00",
    meetingLink: "https://meet.example.com/python-review",
    notes: "Review functions before the upcoming assignment.",
    attendees: 24,
  },
  {
    id: "session-2",
    title: "React Components Workshop",
    course: "React Development",
    date: "2026-08-23",
    startTime: "14:00",
    endTime: "15:30",
    meetingLink: "https://meet.example.com/react-workshop",
    notes: "Bring your component exercises.",
    attendees: 18,
  },
];

function getSavedSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem("edunova-tutor-sessions"));
    return Array.isArray(saved) ? saved : defaultSessions;
  } catch {
    return defaultSessions;
  }
}

function createEmptyForm() {
  return {
    title: "",
    course: assignedCourses[0],
    date: "",
    startTime: "",
    endTime: "",
    meetingLink: "",
    notes: "",
  };
}

function formatDate(date) {
  if (!date) return "No date";
  return new Date(`${date}T00:00:00`).toLocaleDateString();
}

function TutorSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(getSavedSessions);
  const [formData, setFormData] = useState(createEmptyForm);
  const [showForm, setShowForm] = useState(false);
  const [courseFilter, setCourseFilter] = useState("All");
  const [message, setMessage] = useState("");

  const filteredSessions =
    courseFilter === "All"
      ? sessions
      : sessions.filter((session) => session.course === courseFilter);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const saveSessions = (updatedSessions) => {
    setSessions(updatedSessions);
    localStorage.setItem(
      "edunova-tutor-sessions",
      JSON.stringify(updatedSessions)
    );
  };

  const scheduleSession = () => {
    if (
      !formData.title.trim() ||
      !formData.date ||
      !formData.startTime ||
      !formData.endTime
    ) {
      setMessage("Title, date, start time and end time are required.");
      return;
    }

    if (formData.endTime <= formData.startTime) {
      setMessage("End time must be later than the start time.");
      return;
    }

    const newSession = {
      id: `session-${Date.now()}`,
      ...formData,
      title: formData.title.trim(),
      meetingLink: formData.meetingLink.trim(),
      notes: formData.notes.trim(),
      attendees: 0,
    };

    saveSessions([newSession, ...sessions]);
    setFormData(createEmptyForm());
    setShowForm(false);
    setMessage("Learning session scheduled.");
  };

  const cancelSession = (sessionId) => {
    const shouldCancel = window.confirm("Cancel this learning session?");
    if (!shouldCancel) return;

    saveSessions(sessions.filter((session) => session.id !== sessionId));
    setMessage("Learning session cancelled.");
  };

  return (
    <main className="tutor-sessions-page">
      <header className="tutor-sessions-header">
        <div>
          <button
            type="button"
            className="tutor-sessions-back"
            onClick={() => navigate("/tutor-dashboard")}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
          <p>LEARNING SESSIONS</p>
          <h1>Schedule &amp; Sessions</h1>
          <span>
            Schedule live learning sessions for students in your assigned
            courses.
          </span>
        </div>

        <button
          type="button"
          className="tutor-session-primary"
          onClick={() => {
            setShowForm(true);
            setMessage("");
          }}
        >
          <FaPlus /> Schedule Session
        </button>
      </header>

      {message && <div className="tutor-session-message">{message}</div>}

      <section className="tutor-session-summary">
        <article>
          <FaCalendarAlt />
          <div>
            <strong>{sessions.length}</strong>
            <span>Scheduled sessions</span>
          </div>
        </article>
        <article>
          <FaUsers />
          <div>
            <strong>
              {sessions.reduce(
                (total, session) => total + session.attendees,
                0
              )}
            </strong>
            <span>Expected attendees</span>
          </div>
        </article>
        <article>
          <FaClock />
          <div>
            <strong>
              {new Set(sessions.map((session) => session.course)).size}
            </strong>
            <span>Courses with sessions</span>
          </div>
        </article>
      </section>

      {showForm && (
        <section className="tutor-session-form-panel">
          <div className="tutor-session-form-header">
            <div>
              <h2>Schedule Learning Session</h2>
              <p>Add the session information.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormData(createEmptyForm());
                setMessage("");
              }}
            >
              Cancel
            </button>
          </div>

          <div className="tutor-session-form">
            <label className="tutor-session-full-field">
              <span>Session title *</span>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Example: Python Functions Review"
              />
            </label>
            <label>
              <span>Course</span>
              <select name="course" value={formData.course} onChange={handleChange}>
                {assignedCourses.map((course) => (
                  <option value={course} key={course}>
                    {course}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Date *</span>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
              />
            </label>
            <label>
              <span>Start time *</span>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
              />
            </label>
            <label>
              <span>End time *</span>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
              />
            </label>
            <label className="tutor-session-full-field">
              <span>Meeting link</span>
              <input
                type="url"
                name="meetingLink"
                value={formData.meetingLink}
                onChange={handleChange}
                placeholder="https://meet.example.com/session"
              />
            </label>
            <label className="tutor-session-full-field">
              <span>Session notes</span>
              <textarea
                rows="4"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add preparation instructions..."
              />
            </label>
          </div>

          <button
            type="button"
            className="tutor-session-primary"
            onClick={scheduleSession}
          >
            <FaCalendarAlt /> Save Session
          </button>
        </section>
      )}

      <section className="tutor-session-list-panel">
        <div className="tutor-session-list-header">
          <div>
            <h2>Upcoming Sessions</h2>
            <p>Sessions for your assigned courses.</p>
          </div>
          <select
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            aria-label="Filter sessions by course"
          >
            <option value="All">All assigned courses</option>
            {assignedCourses.map((course) => (
              <option value={course} key={course}>
                {course}
              </option>
            ))}
          </select>
        </div>

        <div className="tutor-session-grid">
          {filteredSessions.map((session) => (
            <article className="tutor-session-card" key={session.id}>
              <div className="tutor-session-date">
                <FaCalendarAlt />
                <div>
                  <span>Date</span>
                  <strong>{formatDate(session.date)}</strong>
                </div>
              </div>
              <p className="tutor-session-course">{session.course}</p>
              <h2>{session.title}</h2>
              <div className="tutor-session-information">
                <span>
                  <FaClock /> {session.startTime} – {session.endTime}
                </span>
                <span>
                  <FaUsers /> {session.attendees} attendees
                </span>
              </div>
              {session.notes && (
                <p className="tutor-session-notes">{session.notes}</p>
              )}
              <div className="tutor-session-actions">
                {session.meetingLink ? (
                  <a href={session.meetingLink} target="_blank" rel="noreferrer">
                    <FaLink /> Open Meeting
                  </a>
                ) : (
                  <span className="tutor-session-no-link">No meeting link</span>
                )}
                <button
                  type="button"
                  aria-label={`Cancel ${session.title}`}
                  onClick={() => cancelSession(session.id)}
                >
                  <FaTrash />
                </button>
              </div>
            </article>
          ))}
          {filteredSessions.length === 0 && (
            <div className="tutor-session-empty">
              No sessions found for this course.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default TutorSessions;

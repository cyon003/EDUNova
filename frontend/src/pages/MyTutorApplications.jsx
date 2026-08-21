import { useEffect, useState } from "react";
import { FaChevronLeft, FaClipboardList, FaPlus } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import "../styles/MyTutorApplications.css";

const API = "http://localhost:5050/api/tutor-application";
const statusLabels = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under Review",
  MORE_INFORMATION_NEEDED: "Feedback Available",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function formatDate(value) {
  if (!value) return "Not submitted";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function MyTutorApplications() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API}/mine`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load applications");
        return data;
      })
      .then(setApplications)
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const openApplication = (applicationId) => {
    try {
      const trackers = JSON.parse(localStorage.getItem("edunova-tutor-applications") || "[]");
      const tracker = trackers.find((item) => item.applicationId === applicationId);
      localStorage.setItem("edunova-tutor-application", JSON.stringify(tracker || { applicationId, trackingToken: "account" }));
      navigate("/tutor-application?view=selected");
    } catch {
      setMessage("Unable to open this application.");
    }
  };

  const deleteApplication = async (application) => {
    if (!window.confirm("Delete this tutor application?")) return;
    setMessage("");
    try {
      const trackers = JSON.parse(localStorage.getItem("edunova-tutor-applications") || "[]");
      const tracker = trackers.find((item) => item.applicationId === application._id);
      const response = await fetch(`${API}/applications/${application._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          ...(tracker?.trackingToken ? { "X-Application-Token": tracker.trackingToken } : {}),
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Unable to delete application");
      }
      setApplications((current) => current.filter((item) => item._id !== application._id));
      localStorage.setItem("edunova-tutor-applications", JSON.stringify(trackers.filter((item) => item.applicationId !== application._id)));
      setMessage("Application deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return <main className="my-tutor-applications">
    <header className="my-tutor-applications-header">
      <Link to="/student-dashboard"><FaChevronLeft /> Dashboard</Link>
      <div><h1>My Tutor Applications</h1><p>Review previous applications, admin decisions, and feedback.</p></div>
      <button type="button" onClick={() => navigate("/tutor-application?new=true")}><FaPlus /> New Application</button>
    </header>

    {message && <p className="my-tutor-applications-message" role="status">{message}</p>}
    {loading ? <p className="my-tutor-applications-empty">Loading applications…</p> : applications.length ? (
      <section className="my-tutor-application-list">
        <div className="application-table-head"><span>Application</span><span>Status</span><span aria-hidden="true" /><span aria-hidden="true" /></div>
        {applications.map((application) => {
          return <article key={application._id}>
            <div className="application-name"><strong>{application.expertise || "Tutor application"}</strong><span>{formatDate(application.submittedAt || application.createdAt)}</span>{application.decisionReason && <small>{application.decisionReason}</small>}</div>
            <strong className={`application-status status-${application.status.toLowerCase()}`}>{statusLabels[application.status] || application.status}</strong>
            <button type="button" className="application-text-action" onClick={() => openApplication(application._id)}>Edit</button>
            <button type="button" className="application-text-action delete" onClick={() => deleteApplication(application)}>Delete</button>
          </article>;
        })}
      </section>
    ) : <section className="my-tutor-applications-empty"><FaClipboardList /><h2>No tutor applications yet</h2><p>Start an application when you are ready to teach on EDUNOVA.</p><button type="button" onClick={() => navigate("/tutor-application?new=true")}>Apply as Tutor</button></section>}
  </main>;
}

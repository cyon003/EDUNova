import { useEffect, useState } from "react";
import { FaDownload, FaSearch, FaTimes } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

const API = "http://localhost:5050/api/tutor-application";
const statuses = ["DRAFT", "UNDER_REVIEW", "MORE_INFORMATION_NEEDED", "APPROVED", "REJECTED"];
const label = (value) => value.toLowerCase().replaceAll("_", " ");

export default function AdminTutorApplications() {
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [visibleCount, setVisibleCount] = useState(5);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const load = () => adminApi("/tutor-applications").then(setApplications).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);

  const filtered = applications.filter((application) => {
    const text = `${application.fullName} ${application.email} ${application.expertise} ${application.institution}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (status === "all" || application.status === status);
  });

  const openReview = (application) => {
    setSelected(application);
    setReason(application.decisionReason || "");
    setMessage("");
  };

  const submitDecision = async (decision) => {
    if (decision === "REJECTED" && !reason.trim()) return setMessage("Add feedback before rejecting the application.");
    setSaving(true);
    try {
      const updated = await adminApi(`/tutor-applications/${selected._id}/review`, { method: "PATCH", body: JSON.stringify({ status: decision, reason }) });
      setApplications((items) => items.map((item) => item._id === updated._id ? updated : item));
      setSelected(updated);
      setMessage("Application decision saved.");
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const saveFeedback = async () => {
    if (!reason.trim()) return setMessage("Write feedback before returning it to the applicant.");
    setSendingFeedback(true);
    setMessage("");
    try {
      const updated = await adminApi(`/tutor-applications/${selected._id}/feedback`, { method: "POST", body: JSON.stringify({ feedback: reason }) });
      setMessage("Feedback returned to the applicant.");
      setApplications((items) => items.map((item) => item._id === updated._id ? updated : item));
      setSelected(updated);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSendingFeedback(false);
    }
  };

  const downloadDocument = async (kind) => {
    try {
      const response = await fetch(`${API}/documents/${selected._id}/${kind}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!response.ok) throw new Error("Unable to download document");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = selected[kind].originalName;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) { setMessage(error.message); }
  };

  return <AdminLayout title="Tutor Applications">
    {message && <div className="adm-card">{message}</div>}
    <section className="adm-card">
      <header className="adm-card-hdr"><div><span className="adm-card-title">Application Queue</span><p className="adm-muted">{applications.filter((item) => item.status === "UNDER_REVIEW").length} applications awaiting review</p></div></header>
      <div className="adm-search-row"><label className="adm-search-box"><FaSearch /><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(5); }} placeholder="Search applicant, subject, or institution" /></label><select className="adm-select" value={status} onChange={(event) => { setStatus(event.target.value); setVisibleCount(5); }}><option value="all">All statuses</option>{statuses.map((item) => <option value={item} key={item}>{label(item)}</option>)}</select></div>
      <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Applicant</th><th>Expertise</th><th>Education</th><th>Level</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{filtered.slice(0, visibleCount).map((application) => <tr key={application._id}><td><strong>{application.fullName}</strong><div className="adm-muted">{application.email}</div></td><td>{application.expertise || "—"}</td><td><strong>{application.educationLevel || "—"}</strong><div className="adm-muted">{application.institution}</div></td><td>{application.teachingLevel || "—"}</td><td><span className={`adm-status-pill pill-${application.status.toLowerCase()}`}>{label(application.status)}</span></td><td className="adm-muted">{application.submittedAt ? formatAdminDate(application.submittedAt) : "Not submitted"}</td><td><button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => openReview(application)}>Review</button></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="adm-empty">No tutor applications match this filter.</p>}
      <AdminListControls total={filtered.length} visible={visibleCount} onChange={setVisibleCount} />
    </section>

    {selected && <div className="adm-modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="adm-review-modal adm-tutor-review" role="dialog" aria-modal="true" aria-labelledby="tutor-review-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="adm-review-header"><div><span>TUTOR APPLICATION</span><h2 id="tutor-review-title">{selected.fullName}</h2><p>{selected.email} · {selected.phoneNumber || "No phone number"}</p></div><button className="adm-modal-close" aria-label="Close review" onClick={() => setSelected(null)}><FaTimes /></button></header>
      <div className="adm-application-status-row"><span className={`adm-status-pill pill-${selected.status.toLowerCase()}`}>{label(selected.status)}</span><small>{selected.submittedAt ? `Submitted ${formatAdminDate(selected.submittedAt)}` : "Not submitted"}</small></div>

      <section className="adm-application-section"><h3>Personal Information</h3><div className="adm-application-fields"><div><small>Full Name</small><strong>{selected.fullName}</strong></div><div><small>Email</small><strong>{selected.email}</strong></div><div><small>Phone Number</small><strong>{selected.phoneNumber || "Not provided"}</strong></div><div><small>Identification</small><strong>{[selected.identityType, selected.identityNumber].filter(Boolean).join(" · ") || "Not provided"}</strong></div></div></section>

      <section className="adm-application-section"><h3>Teaching Information</h3><div className="adm-application-fields"><div><small>Subject / Expertise</small><strong>{selected.expertise || "Not provided"}</strong></div><div><small>Teaching Level</small><strong>{selected.teachingLevel || "Not provided"}</strong></div><div className="full"><small>Teaching Experience</small><p>{selected.teachingExperience || "Not provided"}</p></div><div className="full"><small>Short Introduction</small><p>{selected.introduction || "Not provided"}</p></div></div></section>

      <section className="adm-application-section"><h3>Education</h3><div className="adm-application-fields"><div><small>University / Institution</small><strong>{selected.institution || "Not provided"}</strong></div><div><small>Major / Field of Study</small><strong>{selected.major || "Not provided"}</strong></div><div className="full"><small>Highest Education Level</small><strong>{selected.educationLevel || "Not provided"}</strong></div></div></section>

      <section className="adm-application-section"><h3>Documents</h3><div className="adm-evidence-links adm-application-documents">{selected.identityPhoto && <button className="adm-btn adm-btn-secondary" onClick={() => downloadDocument("identityPhoto")}><FaDownload /> ID Copy</button>}{selected.cv && <button className="adm-btn adm-btn-secondary" onClick={() => downloadDocument("cv")}><FaDownload /> CV / Resume</button>}{selected.certificate && <button className="adm-btn adm-btn-secondary" onClick={() => downloadDocument("certificate")}><FaDownload /> Certificate</button>}</div></section>

      <section className="adm-application-section"><h3>Application Question</h3><p className="adm-application-answer">{selected.motivation || "Not provided"}</p><div className="adm-application-confirmation">{selected.confirmed ? "Applicant confirmed the information is correct." : "Applicant did not confirm the information."}</div></section>

      <section className="adm-application-decision"><label className="adm-field"><span className="adm-label">Feedback for applicant</span><textarea className="adm-input adm-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Write feedback to send by email or explain a rejection" /></label></section>
      <footer className="adm-review-actions"><button className="adm-btn adm-btn-secondary" onClick={() => setSelected(null)}>Close</button><button className="adm-btn adm-btn-primary" disabled={sendingFeedback || selected.status === "DRAFT"} onClick={saveFeedback}>{sendingFeedback ? "Saving..." : "Return Feedback"}</button><button className="adm-btn adm-btn-danger" disabled={saving || selected.status === "DRAFT"} onClick={() => submitDecision("REJECTED")}>Reject</button><button className="adm-btn adm-btn-success" disabled={saving || selected.status === "DRAFT"} onClick={() => submitDecision("APPROVED")}>{saving ? "Saving..." : "Approve"}</button></footer>
    </section></div>}
  </AdminLayout>;
}

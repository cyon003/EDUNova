import { useEffect, useState } from "react";
import { FaExternalLinkAlt, FaSearch, FaTimes } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

const decisions = [
  ["verified", "Approve"],
  ["needs_changes", "Request Changes"],
  ["rejected", "Reject"],
  ["suspended", "Suspend"],
];

export default function AdminTutorApplications() {
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [visibleCount, setVisibleCount] = useState(5);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("verified");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => adminApi("/tutor-applications").then(setApplications).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);

  const filtered = applications.filter((application) => {
    const matchesText = `${application.legalName} ${application.tutor?.email || ""} ${application.subjects.join(" ")} ${application.institution}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesText && (status === "all" || application.status === status);
  });

  const openReview = (application) => {
    setSelected(application);
    setDecision(application.status === "verified" ? "verified" : "needs_changes");
    setReason(application.decisionReason || "");
    setMessage("");
  };

  const submitDecision = async () => {
    if (["needs_changes", "rejected", "suspended"].includes(decision) && !reason.trim()) { setMessage("Add a reason for this decision."); return; }
    setSaving(true);
    try {
      const updated = await adminApi(`/tutor-applications/${selected._id}/review`, { method: "PATCH", body: JSON.stringify({ status: decision, reason }) });
      setApplications((items) => items.map((item) => item._id === updated._id ? updated : item));
      setSelected(updated);
      setMessage("Tutor verification decision saved.");
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  return <AdminLayout title="Tutor Applications">
    {message && <div className="adm-card">{message}</div>}
    <section className="adm-card">
      <header className="adm-card-hdr"><div><span className="adm-card-title">Verification Queue</span><p className="adm-muted">{applications.filter((item) => item.status === "pending_review").length} applications awaiting review</p></div></header>
      <div className="adm-search-row"><label className="adm-search-box"><FaSearch /><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(5); }} placeholder="Search tutor, subject, or institution" /></label><select className="adm-select" value={status} onChange={(event) => { setStatus(event.target.value); setVisibleCount(5); }}><option value="all">All statuses</option>{["incomplete", "pending_review", "verified", "needs_changes", "rejected", "suspended"].map((item) => <option value={item} key={item}>{item.replace("_", " ")}</option>)}</select></div>
      <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Tutor</th><th>Subjects</th><th>Education</th><th>Experience</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{filtered.slice(0, visibleCount).map((application) => <tr key={application._id}><td><strong>{application.legalName}</strong><div className="adm-muted">{application.tutor?.email}</div></td><td>{application.subjects.slice(0, 2).join(", ") || "—"}</td><td><strong>{application.educationLevel || "—"}</strong><div className="adm-muted">{application.institution}</div></td><td>{application.teachingExperienceYears} years</td><td><span className={`adm-status-pill pill-${application.status}`}>{application.status.replace("_", " ")}</span></td><td className="adm-muted">{application.submittedAt ? formatAdminDate(application.submittedAt) : "Not submitted"}</td><td><button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => openReview(application)}>Review</button></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="adm-empty">No tutor applications match this filter.</p>}
      <AdminListControls total={filtered.length} visible={visibleCount} onChange={setVisibleCount} />
    </section>

    {selected && <div className="adm-modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="adm-review-modal adm-tutor-review" role="dialog" aria-modal="true" aria-labelledby="tutor-review-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="adm-review-header"><div><span>TUTOR VERIFICATION</span><h2 id="tutor-review-title">{selected.legalName}</h2><p>{selected.tutor?.email} · Submitted {selected.submittedAt ? formatAdminDate(selected.submittedAt) : "as a draft"}</p></div><button className="adm-modal-close" aria-label="Close review" onClick={() => setSelected(null)}><FaTimes /></button></header>
      <div className="adm-review-summary"><div><small>Status</small><strong>{selected.status.replace("_", " ")}</strong></div><div><small>Education</small><strong>{selected.educationLevel || "Not provided"}</strong></div><div><small>Institution</small><strong>{selected.institution || "Not provided"}</strong></div><div><small>Teaching</small><strong>{selected.teachingExperienceYears} years</strong></div></div>
      <div className="adm-tutor-review-grid">
        <section><h3>Profile and expertise</h3><dl><div><dt>Biography</dt><dd>{selected.bio || "Not provided"}</dd></div><div><dt>Subjects</dt><dd>{selected.subjects.join(", ") || "Not provided"}</dd></div><div><dt>Qualification</dt><dd>{[selected.degree, selected.fieldOfStudy, selected.graduationYear].filter(Boolean).join(" · ") || "Not provided"}</dd></div><div><dt>Professional experience</dt><dd>{selected.professionalExperience || "Not provided"}</dd></div><div><dt>Certifications</dt><dd>{selected.certifications.join(", ") || "None listed"}</dd></div></dl></section>
        <section><h3>Evidence</h3><div className="adm-evidence-links">{selected.profilePhotoUrl && <a href={selected.profilePhotoUrl} target="_blank" rel="noreferrer"><FaExternalLinkAlt /> Profile photo</a>}{selected.identityDocumentUrl && <a href={selected.identityDocumentUrl} target="_blank" rel="noreferrer"><FaExternalLinkAlt /> Identity document</a>}{selected.credentialDocumentUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><FaExternalLinkAlt /> Credential {index + 1}</a>)}{selected.portfolioUrl && <a href={selected.portfolioUrl} target="_blank" rel="noreferrer"><FaExternalLinkAlt /> Portfolio</a>}{selected.linkedInUrl && <a href={selected.linkedInUrl} target="_blank" rel="noreferrer"><FaExternalLinkAlt /> LinkedIn</a>}</div><label className="adm-field"><span className="adm-label">Decision</span><select className="adm-input" value={decision} onChange={(event) => setDecision(event.target.value)}>{decisions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="adm-field"><span className="adm-label">Reason or feedback {decision !== "verified" && "*"}</span><textarea className="adm-input adm-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the decision or changes required" /></label></section>
      </div>
      <footer className="adm-review-actions"><button className="adm-btn adm-btn-secondary" onClick={() => setSelected(null)}>Cancel</button><button className={`adm-btn ${decision === "verified" ? "adm-btn-success" : "adm-btn-primary"}`} disabled={saving || selected.status === "incomplete"} onClick={submitDecision}>{saving ? "Saving..." : "Save Decision"}</button></footer>
    </section></div>}
  </AdminLayout>;
}

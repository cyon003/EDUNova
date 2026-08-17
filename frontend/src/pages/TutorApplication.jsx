import { useEffect, useState } from "react";
import { FaChevronLeft, FaSave, FaShieldAlt } from "react-icons/fa";
import { Link } from "react-router-dom";
import "../styles/TutorApplication.css";

const API = "http://localhost:5050/api/tutor-application";
const emptyForm = { legalName: "", profilePhotoUrl: "", bio: "", subjects: "", educationLevel: "", degree: "", fieldOfStudy: "", institution: "", graduationYear: "", teachingExperienceYears: 0, professionalExperience: "", certifications: "", portfolioUrl: "", linkedInUrl: "", identityDocumentUrl: "", credentialDocumentUrls: "" };
const request = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${localStorage.getItem("token")}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
};
const toText = (value) => Array.isArray(value) ? value.join(", ") : "";

export default function TutorApplication() {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("incomplete");
  const [decisionReason, setDecisionReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request("/me").then((application) => {
      setStatus(application.status || "incomplete");
      setDecisionReason(application.decisionReason || "");
      setForm({ ...emptyForm, ...application, subjects: toText(application.subjects), certifications: toText(application.certifications), credentialDocumentUrls: toText(application.credentialDocumentUrls), graduationYear: application.graduationYear || "" });
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  const editable = ["incomplete", "needs_changes", "rejected"].includes(status);
  const payload = () => ({ ...form, graduationYear: form.graduationYear ? Number(form.graduationYear) : null, teachingExperienceYears: Number(form.teachingExperienceYears) || 0, subjects: form.subjects.split(","), certifications: form.certifications.split(","), credentialDocumentUrls: form.credentialDocumentUrls.split(",") });
  const saveDraft = async () => {
    setSaving(true); setMessage("");
    try { const application = await request("/me", { method: "PUT", body: JSON.stringify(payload()) }); setStatus(application.status); setMessage("Draft saved."); }
    catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  const submit = async () => {
    setSaving(true); setMessage("");
    try {
      await request("/me", { method: "PUT", body: JSON.stringify(payload()) });
      const application = await request("/submit", { method: "POST" });
      setStatus(application.status); setDecisionReason(""); setMessage("Application submitted for admin review.");
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (loading) return <main className="tutor-application-page"><p>Loading application...</p></main>;

  return <main className="tutor-application-page">
    <header className="tutor-application-header"><Link to="/tutor-dashboard"><FaChevronLeft /> Dashboard</Link><div><span>TUTOR VERIFICATION</span><h1>Your teaching profile</h1><p>Provide information that helps EDUNOVA confirm your identity and subject expertise.</p></div><span className={`tutor-application-status status-${status}`}>{status.replace("_", " ")}</span></header>
    {decisionReason && <section className="tutor-application-feedback"><strong>Admin feedback</strong><p>{decisionReason}</p></section>}
    {message && <p className="tutor-application-message">{message}</p>}
    <div className="tutor-application-layout">
      <form onSubmit={(event) => event.preventDefault()}>
        <section><header><span>01</span><div><h2>Personal profile</h2><p>This information identifies you to EDUNOVA and your future students.</p></div></header><div className="tutor-form-grid"><label><span>Legal name *</span><input disabled={!editable} value={form.legalName} onChange={(event) => field("legalName", event.target.value)} /></label><label><span>Profile photo URL *</span><input disabled={!editable} type="url" value={form.profilePhotoUrl} onChange={(event) => field("profilePhotoUrl", event.target.value)} placeholder="https://..." /></label><label className="full"><span>Professional biography *</span><textarea disabled={!editable} value={form.bio} onChange={(event) => field("bio", event.target.value)} placeholder="Introduce your background, expertise, and teaching approach." /></label><label className="full"><span>Subjects you can teach * <small>Separate with commas</small></span><input disabled={!editable} value={form.subjects} onChange={(event) => field("subjects", event.target.value)} placeholder="Mathematics, Statistics" /></label></div></section>
        <section><header><span>02</span><div><h2>Education</h2><p>Add the qualification most relevant to the subjects you plan to teach.</p></div></header><div className="tutor-form-grid"><label><span>Highest education level *</span><select disabled={!editable} value={form.educationLevel} onChange={(event) => field("educationLevel", event.target.value)}><option value="">Select level</option><option>Diploma</option><option>Bachelor&apos;s degree</option><option>Master&apos;s degree</option><option>Doctorate</option><option>Professional qualification</option><option>Industry experience</option></select></label><label><span>Institution *</span><input disabled={!editable} value={form.institution} onChange={(event) => field("institution", event.target.value)} /></label><label><span>Degree or qualification *</span><input disabled={!editable} value={form.degree} onChange={(event) => field("degree", event.target.value)} /></label><label><span>Field of study *</span><input disabled={!editable} value={form.fieldOfStudy} onChange={(event) => field("fieldOfStudy", event.target.value)} /></label><label><span>Graduation year *</span><input disabled={!editable} type="number" min="1900" max="2200" value={form.graduationYear} onChange={(event) => field("graduationYear", event.target.value)} /></label><label><span>Certifications * <small>Separate with commas</small></span><input disabled={!editable} value={form.certifications} onChange={(event) => field("certifications", event.target.value)} /></label></div></section>
        <section><header><span>03</span><div><h2>Experience</h2><p>Show how your teaching or professional work relates to your subject.</p></div></header><div className="tutor-form-grid"><label><span>Years of teaching experience *</span><input disabled={!editable} type="number" min="0" max="80" value={form.teachingExperienceYears} onChange={(event) => field("teachingExperienceYears", event.target.value)} /></label><label><span>LinkedIn URL *</span><input disabled={!editable} type="url" value={form.linkedInUrl} onChange={(event) => field("linkedInUrl", event.target.value)} placeholder="https://linkedin.com/in/..." /></label><label className="full"><span>Professional experience *</span><textarea disabled={!editable} value={form.professionalExperience} onChange={(event) => field("professionalExperience", event.target.value)} placeholder="Describe your relevant roles, projects, and teaching experience." /></label><label className="full"><span>Portfolio or professional website *</span><input disabled={!editable} type="url" value={form.portfolioUrl} onChange={(event) => field("portfolioUrl", event.target.value)} placeholder="https://..." /></label></div></section>
        <section><header><span>04</span><div><h2>Verification documents</h2><p>Provide private document links. Students will never see these files.</p></div></header><div className="tutor-form-grid"><label className="full"><span>Identity document link *</span><input disabled={!editable} type="url" value={form.identityDocumentUrl} onChange={(event) => field("identityDocumentUrl", event.target.value)} placeholder="Secure link to passport or national ID" /></label><label className="full"><span>Degree or certificate document links * <small>Separate with commas</small></span><textarea disabled={!editable} value={form.credentialDocumentUrls} onChange={(event) => field("credentialDocumentUrls", event.target.value)} placeholder="Secure links to supporting documents" /></label></div></section>
        {editable && <footer><button type="button" className="secondary" disabled={saving} onClick={saveDraft}><FaSave /> Save Draft</button><button type="button" disabled={saving} onClick={submit}><FaShieldAlt /> {saving ? "Saving..." : "Submit for Review"}</button></footer>}
      </form>
      <aside><h2>Before you submit</h2><ul><li>Use your legal name.</li><li>Choose subjects that match your experience.</li><li>Provide accessible document links.</li><li>Do not include private documents in public profile links.</li></ul><p>Only EDUNOVA administrators can review identity and credential documents.</p></aside>
    </div>
  </main>;
}

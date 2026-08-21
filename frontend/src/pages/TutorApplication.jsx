import { useEffect, useState } from "react";
import { FaChevronLeft, FaFileAlt, FaSave } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../styles/TutorApplication.css";

const API = "http://localhost:5050/api/tutor-application";
const initialForm = {
  fullName: "",
  email: "",
  phoneNumber: "",
  identityType: "",
  identityNumber: "",
  expertise: "",
  teachingLevel: "",
  teachingExperience: "",
  introduction: "",
  institution: "",
  major: "",
  educationLevel: "",
  motivation: "",
  confirmed: false,
};

const statusLabels = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under Review",
  MORE_INFORMATION_NEEDED: "More Information Needed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

async function apiRequest(path, options = {}, trackingToken = "") {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, ...(trackingToken ? { "X-Application-Token": trackingToken } : {}), ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export default function TutorApplication() {
  const navigate = useNavigate();
  const account = (() => {
    try { return JSON.parse(localStorage.getItem("user")); }
    catch { return null; }
  })();
  const [savedTracking] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get("new") === "true") return null;
      const active = JSON.parse(localStorage.getItem("edunova-tutor-application") || "null");
      if (active) return active;
      const history = JSON.parse(localStorage.getItem("edunova-tutor-applications") || "[]");
      return history.at(-1) || null;
    } catch {
      return null;
    }
  });
  const [form, setForm] = useState({ ...initialForm, fullName: account?.name || "", email: account?.email || "" });
  const [status, setStatus] = useState("DRAFT");
  const [applicationId, setApplicationId] = useState(savedTracking?.applicationId || "");
  const [cv, setCv] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [identityPhoto, setIdentityPhoto] = useState(null);
  const [savedCv, setSavedCv] = useState(null);
  const [savedCertificate, setSavedCertificate] = useState(null);
  const [savedIdentityPhoto, setSavedIdentityPhoto] = useState(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(savedTracking?.applicationId && savedTracking?.trackingToken));
  const [saving, setSaving] = useState(false);
  const [trackingToken, setTrackingToken] = useState(savedTracking?.trackingToken || "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!savedTracking?.applicationId || !savedTracking?.trackingToken) return;
    apiRequest(`/applications/${savedTracking.applicationId}`, {}, savedTracking.trackingToken)
      .then((application) => {
        setApplicationId(application._id || "");
        setStatus(application.status || "DRAFT");
        setDecisionReason(application.decisionReason || "");
        setSavedCv(application.cv || null);
        setSavedCertificate(application.certificate || null);
        setSavedIdentityPhoto(application.identityPhoto || null);
        setForm({
          ...initialForm,
          ...Object.fromEntries(Object.keys(initialForm).map((key) => [key, application[key] ?? initialForm[key]])),
        });
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [savedTracking]);

  const editable = true;
  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setIsDirty(true);
  };
  const chooseFile = (setter) => (event) => {
    setter(event.target.files[0] || null);
    setIsDirty(true);
  };
  const exitApplication = async () => {
    if (applicationId && status === "DRAFT") {
      await fetch(`${API}/applications/${applicationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "X-Application-Token": trackingToken },
      }).catch(() => undefined);
    }
    localStorage.removeItem("edunova-tutor-application");
    navigate("/");
  };

  const saveApplication = async () => {
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, String(value)));
    if (cv) body.append("cv", cv);
    if (certificate) body.append("certificate", certificate);
    if (identityPhoto) body.append("identityPhoto", identityPhoto);
    const response = applicationId
      ? await apiRequest(`/applications/${applicationId}`, { method: "PUT", body }, trackingToken)
      : await apiRequest("/applications", { method: "POST", body });
    const application = response.application || response;
    const nextToken = response.trackingToken || trackingToken;
    setApplicationId(application._id);
    setTrackingToken(nextToken);
    localStorage.setItem("edunova-tutor-application", JSON.stringify({ applicationId: application._id, trackingToken: nextToken }));
    setStatus(application.status);
    setSavedCv(application.cv || null);
    setSavedCertificate(application.certificate || null);
    setSavedIdentityPhoto(application.identityPhoto || null);
    setCv(null);
    setCertificate(null);
    setIdentityPhoto(null);
    setIsDirty(false);
    return application;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setMessage("");
    try {
      await saveApplication();
      setMessage("Your draft has been saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    if (!event.currentTarget.form.reportValidity()) return;
    setSaving(true);
    setMessage("");
    try {
      const application = await apiRequest(`/applications/${applicationId}/submit`, { method: "POST" }, trackingToken);
      setStatus(application.status);
      const history = JSON.parse(localStorage.getItem("edunova-tutor-applications") || "[]");
      const withoutCurrent = history.filter((item) => item.applicationId !== applicationId);
      localStorage.setItem("edunova-tutor-applications", JSON.stringify([...withoutCurrent, { applicationId, trackingToken, submittedAt: application.submittedAt }]));
      setMessage("Your tutor application has been submitted and is waiting for admin approval.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="tutor-application-page"><p className="tutor-application-loading">Loading your application…</p></main>;

  return (
    <main className="tutor-application-page">
      <header className="tutor-application-header">
        <button type="button" className="tutor-application-back" onClick={exitApplication}><FaChevronLeft /> Home</button>
        <div>
          <h1>Tutor Application</h1>
        </div>
        {status !== "DRAFT" && <span className={`tutor-application-status status-${status.toLowerCase()}`}>{statusLabels[status]}</span>}
      </header>

      {status === "UNDER_REVIEW" && (
        <section className="tutor-application-result">
          <strong>Application Status: Under Review</strong>
          <p>Your tutor application has been submitted and is waiting for admin approval.</p>
        </section>
      )}
      {decisionReason && <section className="tutor-application-feedback"><strong>Admin feedback</strong><p>{decisionReason}</p></section>}
      {message && <p className="tutor-application-message" role="status">{message}</p>}

      <form className="tutor-application-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={!editable || saving}>
          <section className="tutor-form-section">
            <header><div><h2>Personal Information</h2><p>Tell us how we can contact you.</p></div></header>
            <div className="tutor-form-grid">
              <label><span>Full Name *</span><input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required /></label>
              <label><span>Email *</span><input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required /></label>
              <label><span>Phone Number *</span><input type="tel" value={form.phoneNumber} onChange={(event) => updateField("phoneNumber", event.target.value)} required /></label>
              <label><span>Passport or National ID *</span><select value={form.identityType} onChange={(event) => updateField("identityType", event.target.value)} required><option value="">Select ID type</option><option>Passport</option><option>National ID</option></select></label>
              <label><span>ID Number *</span><input value={form.identityNumber} onChange={(event) => updateField("identityNumber", event.target.value)} required /></label>
              <label className="full tutor-file-field"><span>Passport or National ID Copy *</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={chooseFile(setIdentityPhoto)} required={!savedIdentityPhoto} />{(identityPhoto || savedIdentityPhoto) && <small><FaFileAlt /> {identityPhoto?.name || savedIdentityPhoto.originalName}</small>}</label>
            </div>
          </section>

          <section className="tutor-form-section">
            <header><div><h2>Teaching Information</h2><p>Share what and whom you are prepared to teach.</p></div></header>
            <div className="tutor-form-grid">
              <label><span>Subject / Expertise *</span><input value={form.expertise} onChange={(event) => updateField("expertise", event.target.value)} required /></label>
              <label><span>Teaching Level *</span><select value={form.teachingLevel} onChange={(event) => updateField("teachingLevel", event.target.value)} required><option value="">Select a level</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
              <label className="full"><span>Teaching Experience *</span><textarea value={form.teachingExperience} onChange={(event) => updateField("teachingExperience", event.target.value)} required /></label>
              <label className="full"><span>Short Introduction *</span><textarea value={form.introduction} onChange={(event) => updateField("introduction", event.target.value)} required /></label>
            </div>
          </section>

          <section className="tutor-form-section">
            <header><div><h2>Education</h2><p>Add your highest or most relevant qualification.</p></div></header>
            <div className="tutor-form-grid">
              <label><span>University / Institution *</span><input value={form.institution} onChange={(event) => updateField("institution", event.target.value)} required /></label>
              <label><span>Major / Field of Study *</span><input value={form.major} onChange={(event) => updateField("major", event.target.value)} required /></label>
              <label className="full"><span>Highest Education Level *</span><input value={form.educationLevel} onChange={(event) => updateField("educationLevel", event.target.value)} placeholder="Example: Bachelor's degree" required /></label>
            </div>
          </section>

          <section className="tutor-form-section">
            <header><div><h2>Documents</h2><p>Upload documents or screenshots up to 5 MB.</p></div></header>
            <div className="tutor-form-grid">
              <label className="tutor-file-field"><span>CV / Resume *</span><input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={chooseFile(setCv)} required={!savedCv} />{(cv || savedCv) && <small><FaFileAlt /> {cv?.name || savedCv.originalName}</small>}</label>
              <label className="tutor-file-field"><span>Certificate (optional)</span><input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={chooseFile(setCertificate)} />{(certificate || savedCertificate) && <small><FaFileAlt /> {certificate?.name || savedCertificate.originalName}</small>}</label>
            </div>
          </section>

          <section className="tutor-form-section">
            <header><div><h2>Application Question</h2></div></header>
            <div className="tutor-form-grid"><label className="full"><span>Why do you want to become a tutor? *</span><textarea value={form.motivation} onChange={(event) => updateField("motivation", event.target.value)} required /></label></div>
            <label className="tutor-confirmation"><input type="checkbox" checked={form.confirmed} onChange={(event) => updateField("confirmed", event.target.checked)} required /><span>I confirm that the information I provided is correct.</span></label>
          </section>
        </fieldset>

        {editable && <footer><div><button type="button" className="tutor-cancel-button" onClick={exitApplication}>Cancel</button><button type="button" className="secondary" disabled={saving || !isDirty} onClick={handleSaveDraft}><FaSave /> {saving ? "Saving…" : "Save"}</button></div>{applicationId && status === "DRAFT" && !isDirty && <button type="button" disabled={saving} onClick={handleSubmit}>Submit Application</button>}</footer>}
        {!editable && applicationId && <p className="tutor-application-locked">This application is read-only while it is {statusLabels[status].toLowerCase()}.</p>}
      </form>
    </main>
  );
}

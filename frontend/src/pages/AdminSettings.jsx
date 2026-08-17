import { useEffect, useState } from "react";
import { FaBullhorn, FaHistory, FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [audit, setAudit] = useState([]);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", audience: "All Users" });
  const [announcementCount, setAnnouncementCount] = useState(5);
  const [auditCount, setAuditCount] = useState(5);

  const load = () => Promise.all([adminApi("/settings"), adminApi("/announcements"), adminApi("/audit")])
    .then(([config, notices, activity]) => { setSettings(config); setAnnouncements(notices); setAudit(activity); })
    .catch((error) => setMessage(error.message));

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (settings.maxEnrollment < 1 || settings.minPassScore < 0 || settings.minPassScore > 100 || settings.sessionTimeout < 1 || settings.maxLoginAttempts < 1) {
      setMessage("Check the policy values before saving.");
      return;
    }
    setSaving(true);
    try {
      setSettings(await adminApi("/settings", { method: "PATCH", body: JSON.stringify(settings) }));
      setMessage("Platform settings saved successfully.");
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const addCategory = () => {
    const value = category.trim();
    if (!value) return;
    if (settings.categories.some((item) => item.toLowerCase() === value.toLowerCase())) { setMessage("That category already exists."); return; }
    setSettings({ ...settings, categories: [...settings.categories, value] });
    setCategory("");
  };

  const createAnnouncement = async (event) => {
    event.preventDefault();
    if (!announcementForm.title.trim()) return;
    try {
      await adminApi("/announcements", { method: "POST", body: JSON.stringify({ ...announcementForm, title: announcementForm.title.trim() }) });
      setAnnouncementOpen(false);
      setAnnouncementForm({ title: "", audience: "All Users" });
      await load();
      setMessage("Announcement published.");
    } catch (error) { setMessage(error.message); }
  };

  const removeAnnouncement = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try { await adminApi(`/announcements/${id}`, { method: "DELETE" }); await load(); }
    catch (error) { setMessage(error.message); }
  };

  if (!settings) return <AdminLayout title="Platform Settings"><div className="adm-card">{message || "Loading settings..."}</div></AdminLayout>;

  const updateNumber = (key, value) => setSettings({ ...settings, [key]: Number(value) });

  return (
    <AdminLayout title="Platform Settings">
      {message && <div className="adm-card adm-settings-message">{message}</div>}

      <section className="adm-card">
        <header className="adm-card-hdr"><div><span className="adm-card-title">Learning & Enrollment</span><p className="adm-muted">Control course capacity, completion requirements, and enrollment access.</p></div><button className="adm-btn adm-btn-primary" disabled={saving} onClick={save}><FaSave /> {saving ? "Saving..." : "Save Changes"}</button></header>
        <div className="adm-settings-grid">
          <label className="adm-setting-field"><span>Students per course</span><small>Maximum number of students allowed in one course.</small><input className="adm-input" type="number" min="1" value={settings.maxEnrollment} onChange={(event) => updateNumber("maxEnrollment", event.target.value)} /></label>
          <label className="adm-setting-field"><span>Passing score (%)</span><small>Minimum score required to pass assessments.</small><input className="adm-input" type="number" min="0" max="100" value={settings.minPassScore} onChange={(event) => updateNumber("minPassScore", event.target.value)} /></label>
        </div>
        <div className="adm-toggle-list">
          <label><div><strong>Require course approval</strong><small>Only admin-approved courses can accept enrollment.</small></div><input type="checkbox" checked={settings.approvalRequired} onChange={(event) => setSettings({ ...settings, approvalRequired: event.target.checked })} /></label>
          <label><div><strong>Allow student self-enrollment</strong><small>Students can enroll without manual admin approval.</small></div><input type="checkbox" checked={settings.allowSelfEnroll} onChange={(event) => setSettings({ ...settings, allowSelfEnroll: event.target.checked })} /></label>
        </div>
      </section>

      <section className="adm-card">
        <header className="adm-card-hdr"><div><span className="adm-card-title">Security</span><p className="adm-muted">These settings are enforced during login.</p></div></header>
        <div className="adm-settings-grid">
          <label className="adm-setting-field"><span>Session timeout (minutes)</span><small>Users must log in again when the session expires.</small><input className="adm-input" type="number" min="1" value={settings.sessionTimeout} onChange={(event) => updateNumber("sessionTimeout", event.target.value)} /></label>
          <label className="adm-setting-field"><span>Maximum login attempts</span><small>Account login is paused for 5 minutes after this limit.</small><input className="adm-input" type="number" min="1" value={settings.maxLoginAttempts} onChange={(event) => updateNumber("maxLoginAttempts", event.target.value)} /></label>
        </div>
      </section>

      <section className="adm-card">
        <header className="adm-card-hdr"><div><span className="adm-card-title">Course Categories</span><p className="adm-muted">Keep course discovery organized with reusable categories.</p></div></header>
        <div className="adm-category-add"><input className="adm-input" value={category} onChange={(event) => setCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); }} placeholder="Enter a category name" /><button className="adm-btn adm-btn-primary" onClick={addCategory}><FaPlus /> Add Category</button></div>
        <div className="adm-category-list">{settings.categories.map((item) => <span key={item}>{item}<button aria-label={`Remove ${item}`} onClick={() => setSettings({ ...settings, categories: settings.categories.filter((value) => value !== item) })}><FaTimes /></button></span>)}</div>
      </section>

      <section className="adm-card">
        <header className="adm-card-hdr"><div><span className="adm-card-title"><FaBullhorn /> Announcements</span><p className="adm-muted">Publish important platform messages to a selected audience.</p></div><button className="adm-btn adm-btn-primary" onClick={() => setAnnouncementOpen(true)}><FaPlus /> New Announcement</button></header>
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Announcement</th><th>Audience</th><th>Published</th><th>Action</th></tr></thead><tbody>{announcements.slice(0, announcementCount).map((item) => <tr key={item._id}><td><strong>{item.title}</strong></td><td>{item.audience}</td><td className="adm-muted">{formatAdminDate(item.createdAt)}</td><td><button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => removeAnnouncement(item._id)}><FaTrash /> Delete</button></td></tr>)}</tbody></table></div>
        {!announcements.length && <p className="adm-empty">No announcements have been published.</p>}
        <AdminListControls total={announcements.length} visible={announcementCount} onChange={setAnnouncementCount} />
      </section>

      <section className="adm-card">
        <header className="adm-card-hdr"><div><span className="adm-card-title"><FaHistory /> Audit Log</span><p className="adm-muted">A permanent history of important admin actions.</p></div></header>
        {audit.slice(0, auditCount).map((item) => <article className="adm-activity-item" key={item._id}><div><strong className="adm-activity-action">{item.action}</strong><p className="adm-activity-detail">{item.detail} · {item.admin?.name || "Admin"}</p><small className="adm-activity-time">{formatAdminDate(item.createdAt)}</small></div></article>)}
        {!audit.length && <p className="adm-empty">No admin activity has been recorded.</p>}
        <AdminListControls total={audit.length} visible={auditCount} onChange={setAuditCount} />
      </section>

      {announcementOpen && <div className="adm-modal-overlay" role="presentation" onMouseDown={() => setAnnouncementOpen(false)}><form className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-title" onSubmit={createAnnouncement} onMouseDown={(event) => event.stopPropagation()}><h2 className="adm-modal-title" id="announcement-title">New Announcement</h2><p className="adm-modal-description">Create a short message for users across EDUNOVA.</p><label className="adm-field"><span className="adm-label">Message</span><textarea className="adm-input adm-announcement-input" required maxLength="300" value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} placeholder="Write the announcement" /></label><label className="adm-field"><span className="adm-label">Audience</span><select className="adm-input" value={announcementForm.audience} onChange={(event) => setAnnouncementForm({ ...announcementForm, audience: event.target.value })}><option>All Users</option><option>Students</option><option>Tutors</option></select></label><div className="adm-modal-footer"><button className="adm-btn adm-btn-secondary" type="button" onClick={() => setAnnouncementOpen(false)}>Cancel</button><button className="adm-btn adm-btn-primary" type="submit">Publish</button></div></form></div>}
    </AdminLayout>
  );
}

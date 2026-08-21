import { useEffect, useState } from "react";
import { FaBan, FaCheck, FaEdit, FaKey, FaPlus, FaSearch, FaTrash } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

export default function AdminTutors() {
  const [tutors, setTutors] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [showAddTutor, setShowAddTutor] = useState(false);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTutor, setNewTutor] = useState({ name: "", email: "", temporaryPassword: "" });
  const [visibleCount, setVisibleCount] = useState(5);
  const load = async () => {
    try { setTutors(await adminApi("/tutors")); setMessage(""); }
    catch (error) { setMessage(error.message); }
  };

  useEffect(() => {
    adminApi("/tutors").then(setTutors).catch((error) => setMessage(error.message));
  }, []);

  const closeAddTutor = () => {
    if (creating) return;
    setShowAddTutor(false);
    setFormError("");
    setNewTutor({ name: "", email: "", temporaryPassword: "" });
  };
  const createTutor = async (event) => {
    event.preventDefault();
    if (!newTutor.name.trim() || !newTutor.email.trim() || !newTutor.temporaryPassword) {
      setFormError("Complete all fields before creating the tutor.");
      return;
    }
    if (newTutor.temporaryPassword.length < 6) {
      setFormError("The temporary password must contain at least 6 characters.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      await adminApi("/tutors", { method: "POST", body: JSON.stringify({ ...newTutor, name: newTutor.name.trim(), email: newTutor.email.trim() }) });
      await load();
      setShowAddTutor(false);
      setNewTutor({ name: "", email: "", temporaryPassword: "" });
      setMessage("Tutor account created successfully.");
    } catch (error) { setFormError(error.message); }
    finally { setCreating(false); }
  };
  const editTutor = async (tutor) => {
    const name = window.prompt("Tutor name", tutor.name); if (!name) return;
    const email = window.prompt("Tutor email", tutor.email); if (!email) return;
    try { await adminApi(`/tutors/${tutor._id || tutor.id}`, { method: "PATCH", body: JSON.stringify({ name, email }) }); await load(); }
    catch (error) { setMessage(error.message); }
  };
  const resetPassword = async (tutor) => {
    const newPassword = window.prompt(`New temporary password for ${tutor.name}`); if (!newPassword) return;
    try { await adminApi(`/tutors/${tutor._id || tutor.id}/reset-password`, { method: "PATCH", body: JSON.stringify({ newPassword }) }); setMessage("Password reset successfully"); }
    catch (error) { setMessage(error.message); }
  };
  const toggleStatus = async (tutor) => {
    const action = tutor.accountStatus === "suspended" ? "activate" : "suspend";
    try { await adminApi(`/tutors/${tutor._id || tutor.id}/${action}`, { method: "PATCH" }); await load(); }
    catch (error) { setMessage(error.message); }
  };
  const removeTutor = async (tutor) => {
    if (!window.confirm(`Permanently remove ${tutor.name}? Their assigned courses will become unassigned.`)) return;
    try { await adminApi(`/tutors/${tutor._id || tutor.id}`, { method: "DELETE" }); await load(); }
    catch (error) { setMessage(error.message); }
  };
  const filtered = tutors.filter((tutor) => `${tutor.name} ${tutor.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Tutor Management">
      {message && <div className="adm-card">{message}</div>}
      <div className="adm-card">
        <div className="adm-card-hdr"><span className="adm-card-title">All Tutors</span><button className="adm-btn adm-btn-primary" onClick={() => setShowAddTutor(true)}><FaPlus /> Add Tutor</button></div>
        <div className="adm-search-row"><label className="adm-search-box"><FaSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tutors" /></label></div>
        <table className="adm-table">
          <thead><tr><th>Tutor</th><th>Verification</th><th>Account</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>{filtered.slice(0, visibleCount).map((tutor) => (
            <tr key={tutor._id || tutor.id}>
              <td><strong>{tutor.name}</strong><div className="adm-muted">{tutor.email}</div></td>
              <td><span className={`adm-status-pill pill-${(tutor.tutorVerificationStatus || "DRAFT").toLowerCase()}`}>{(tutor.tutorVerificationStatus || "DRAFT").toLowerCase().replaceAll("_", " ")}</span></td>
              <td><span className={`adm-status-pill ${tutor.accountStatus === "suspended" ? "pill-suspended" : "pill-active"}`}>{tutor.accountStatus}</span></td>
              <td className="adm-muted">{tutor.lastLoginAt ? formatAdminDate(tutor.lastLoginAt) : "Never"}</td>
              <td className="adm-muted">{formatAdminDate(tutor.createdAt)}</td>
              <td><div style={{ display: "flex", gap: 6 }}>
                <button className="adm-btn adm-btn-secondary adm-btn-sm" aria-label={`Edit ${tutor.name}`} onClick={() => editTutor(tutor)}><FaEdit /></button>
                <button className="adm-btn adm-btn-secondary adm-btn-sm" aria-label={`Reset ${tutor.name}'s password`} onClick={() => resetPassword(tutor)}><FaKey /></button>
                <button className={`adm-btn adm-btn-sm ${tutor.accountStatus === "suspended" ? "adm-btn-success" : "adm-btn-danger"}`} aria-label={`${tutor.accountStatus === "suspended" ? "Reactivate" : "Suspend"} ${tutor.name}`} onClick={() => toggleStatus(tutor)}>{tutor.accountStatus === "suspended" ? <FaCheck /> : <FaBan />}</button>
                {tutor.accountStatus === "suspended" && <button className="adm-btn adm-btn-danger adm-btn-sm" aria-label={`Remove ${tutor.name}`} title="Remove account permanently" onClick={() => removeTutor(tutor)}><FaTrash /></button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        <AdminListControls total={filtered.length} visible={visibleCount} onChange={setVisibleCount} />
      </div>

      {showAddTutor && (
        <div className="adm-modal-overlay" role="presentation" onMouseDown={closeAddTutor}>
          <form className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="add-tutor-title" onSubmit={createTutor} onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="adm-modal-title" id="add-tutor-title">Add a New Tutor</h2>
            <p className="adm-modal-description">Create a tutor account and provide them with a temporary password.</p>
            {formError && <div className="adm-form-error">{formError}</div>}
            <label className="adm-field">
              <span className="adm-label">Full name</span>
              <input className="adm-input" autoFocus value={newTutor.name} onChange={(event) => setNewTutor({ ...newTutor, name: event.target.value })} placeholder="Enter tutor name" />
            </label>
            <label className="adm-field">
              <span className="adm-label">Email address</span>
              <input className="adm-input" type="email" value={newTutor.email} onChange={(event) => setNewTutor({ ...newTutor, email: event.target.value })} placeholder="tutor@example.com" />
            </label>
            <label className="adm-field">
              <span className="adm-label">Temporary password</span>
              <input className="adm-input" type="password" minLength="6" value={newTutor.temporaryPassword} onChange={(event) => setNewTutor({ ...newTutor, temporaryPassword: event.target.value })} placeholder="At least 6 characters" />
            </label>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" type="button" disabled={creating} onClick={closeAddTutor}>Cancel</button>
              <button className="adm-btn adm-btn-primary" type="submit" disabled={creating}>{creating ? "Creating..." : "Create Tutor"}</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}

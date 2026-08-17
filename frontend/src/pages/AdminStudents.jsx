import { useEffect, useState } from "react";
import { FaBan, FaCheck, FaKey, FaSearch, FaTrash, FaUserGraduate } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);

  const loadStudents = async () => {
    try {
      setStudents(await adminApi("/students"));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    adminApi("/students")
      .then(setStudents)
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (student) => {
    const accountStatus = student.accountStatus === "suspended" ? "approved" : "suspended";
    try {
      await adminApi(`/students/${student._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ accountStatus }),
      });
      await loadStudents();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const resetPassword = async (student) => {
    const newPassword = window.prompt(`New temporary password for ${student.name}`);
    if (!newPassword) return;
    try {
      await adminApi(`/students/${student._id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword }),
      });
      setMessage("Password reset successfully");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const removeStudent = async (student) => {
    if (!window.confirm(`Permanently remove ${student.name}? Their enrollments and notes will also be deleted.`)) return;
    try {
      await adminApi(`/students/${student._id}`, { method: "DELETE" });
      await loadStudents();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const filteredStudents = students.filter((student) =>
    `${student.name} ${student.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <AdminLayout title="Students">
      {message && <div className="adm-card">{message}</div>}
      <section className="adm-card">
        <div className="adm-card-hdr">
          <div>
            <span className="adm-card-title"><FaUserGraduate /> Student List</span>
            <p className="adm-muted">{students.length} registered {students.length === 1 ? "student" : "students"}</p>
          </div>
        </div>

        <div className="adm-search-row">
          <label className="adm-search-box">
            <FaSearch />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by student name or email" />
          </label>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Student</th><th>Enrolled Courses</th><th>Lessons Completed</th><th>Joined</th><th>Last Active</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredStudents.slice(0, visibleCount).map((student) => (
                <tr key={student._id}>
                  <td><strong>{student.name}</strong><div className="adm-muted">{student.email}</div></td>
                  <td>{student.enrollmentStats?.enrolled || 0}</td>
                  <td>{student.enrollmentStats?.completedLessons || 0}</td>
                  <td className="adm-muted">{formatAdminDate(student.createdAt)}</td>
                  <td className="adm-muted">{formatAdminDate(student.enrollmentStats?.lastActive)}</td>
                  <td><span className={`adm-status-pill ${student.accountStatus === "suspended" ? "pill-suspended" : "pill-active"}`}>{student.accountStatus === "suspended" ? "Suspended" : "Active"}</span></td>
                  <td><div style={{ display: "flex", gap: 6 }}>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" aria-label={`Reset ${student.name}'s password`} title="Reset password" onClick={() => resetPassword(student)}><FaKey /></button>
                    <button className={`adm-btn adm-btn-sm ${student.accountStatus === "suspended" ? "adm-btn-success" : "adm-btn-danger"}`} aria-label={`${student.accountStatus === "suspended" ? "Reactivate" : "Suspend"} ${student.name}`} title={student.accountStatus === "suspended" ? "Reactivate student" : "Suspend student"} onClick={() => toggleStatus(student)}>{student.accountStatus === "suspended" ? <FaCheck /> : <FaBan />}</button>
                    {student.accountStatus === "suspended" && <button className="adm-btn adm-btn-danger adm-btn-sm" aria-label={`Remove ${student.name}`} title="Remove account permanently" onClick={() => removeStudent(student)}><FaTrash /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <p className="adm-empty">Loading students...</p>}
        {!loading && !filteredStudents.length && <p className="adm-empty">{search ? "No students match your search." : "No student accounts have been registered yet."}</p>}
        <AdminListControls total={filteredStudents.length} visible={visibleCount} onChange={setVisibleCount} />
      </section>
    </AdminLayout>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaBookOpen, FaChalkboardTeacher, FaClock, FaExclamationCircle, FaHistory, FaUsers } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState([]);
  const [visibleActivityCount, setVisibleActivityCount] = useState(5);
  const [visibleRegistrationCount, setVisibleRegistrationCount] = useState(5);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminApi("/overview"), adminApi("/audit")])
      .then(([overview, activity]) => { setData(overview); setAudit(activity); })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const stats = data ? [
    ["Students", data.students, "Registered accounts", FaUsers],
    ["Tutors", data.tutors, "Teaching accounts", FaChalkboardTeacher],
    ["Courses", data.courses, "Across the catalog", FaBookOpen],
    ["Study time", `${Math.round(data.totalStudySeconds / 3600)}h`, "Recorded learning time", FaClock],
  ] : [];
  const recentUsers = data?.recentUsers || [];

  return (
    <AdminLayout title="Dashboard Overview">
      {error && <div className="adm-card">{error}</div>}

      <div className="adm-overview-stats">
        {stats.map(([label, value, note, Icon]) => <article key={label}><div className="adm-overview-stat-icon"><Icon /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>)}
      </div>

      {data && <section className="adm-overview-status">
        <div><span>Enrollments</span><strong>{data.enrollments}</strong><small>Current course enrollments</small></div>
        <div><span>Completed courses</span><strong>{data.completedCourses}</strong><small>Finished by students</small></div>
        <Link to="/admin-dashboard/courses" className={data.pendingCourses ? "needs-attention" : ""}><span>Pending courses</span><strong>{data.pendingCourses}</strong><small>{data.pendingCourses ? "Waiting for your review" : "Nothing waiting"}</small></Link>
        <Link to="/admin-dashboard/reports" className={data.pendingReports ? "needs-attention" : ""}><span>Pending reports</span><strong>{data.pendingReports}</strong><small>{data.pendingReports ? "Requires attention" : "No open reports"}</small></Link>
      </section>}

      <div className="adm-overview-columns">
        <section className="adm-card adm-overview-registrations">
          <header className="adm-card-hdr"><div><span className="adm-card-title">Recent Registrations</span><p className="adm-muted">Newest student and tutor accounts</p></div></header>
          <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>{recentUsers.slice(0, visibleRegistrationCount).map((user) => <tr key={user._id}><td><div className="adm-overview-user"><span>{user.name?.[0]?.toUpperCase() || "U"}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td><td className="adm-capitalize">{user.role}</td><td><span className={`adm-status-pill ${user.accountStatus === "approved" ? "pill-active" : "pill-suspended"}`}>{user.accountStatus === "approved" ? "Active" : "Suspended"}</span></td><td className="adm-muted">{formatAdminDate(user.createdAt)}</td></tr>)}</tbody></table></div>
          {!recentUsers.length && <p className="adm-empty">No registrations yet.</p>}
          <AdminListControls total={recentUsers.length} visible={visibleRegistrationCount} onChange={setVisibleRegistrationCount} />
        </section>

        <section className="adm-card adm-overview-activity">
          <header className="adm-card-hdr"><div><span className="adm-card-title">System Activity</span><p className="adm-muted">Latest administrative changes</p></div></header>
          <div className="adm-overview-activity-list">{audit.slice(0, visibleActivityCount).map((item) => <article key={item._id}><span><FaHistory /></span><div><strong>{item.action}</strong><p>{item.detail}</p><small>{formatAdminDate(item.createdAt)}</small></div></article>)}</div>
          {!audit.length && <div className="adm-overview-empty"><FaExclamationCircle /><p>No activity has been recorded.</p></div>}
          <AdminListControls total={audit.length} visible={visibleActivityCount} onChange={setVisibleActivityCount} />
        </section>
      </div>
    </AdminLayout>
  );
}

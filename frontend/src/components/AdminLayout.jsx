import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaBell, FaBookOpen, FaChartBar, FaChalkboardTeacher, FaCog, FaFileAlt, FaIdCard, FaSignOutAlt, FaUsers } from "react-icons/fa";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user")); }
  catch { return null; }
}

const NAV = [
  { icon: <FaChartBar />, label: "Overview", to: "/admin-dashboard" },
  { icon: <FaChalkboardTeacher />, label: "Tutors", to: "/admin-dashboard/tutors" },
  { icon: <FaIdCard />, label: "Applications", to: "/admin-dashboard/tutor-applications" },
  { icon: <FaUsers />, label: "Students", to: "/admin-dashboard/students" },
  { icon: <FaBookOpen />, label: "Courses", to: "/admin-dashboard/courses" },
  { icon: <FaFileAlt />, label: "Reports", to: "/admin-dashboard/reports" },
  { icon: <FaCog />, label: "Settings", to: "/admin-dashboard/settings" },
];

export default function AdminLayout({ children, title, subtitle }) {
  const user = getStoredUser();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => localStorage.getItem("edunova-admin-notifications-seen") || new Date(0).toISOString());

  useEffect(() => {
    let active = true;
    const loadNotifications = () => adminApi("/notifications")
      .then((items) => { if (active) setNotifications(items); })
      .catch(() => {});
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 20000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const unreadCount = notifications.filter((item) => new Date(item.createdAt) > new Date(lastSeen)).length;
  const toggleNotifications = () => {
    setNotificationsOpen((open) => !open);
    if (!notificationsOpen) {
      const seenAt = new Date().toISOString();
      localStorage.setItem("edunova-admin-notifications-seen", seenAt);
      setLastSeen(seenAt);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/auth";
  };

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <div className="adm-logo"><span className="adm-edu">EDU</span><span className="adm-nova">NOVA</span></div>
        <nav className="adm-nav">
          {NAV.map((item) => <Link key={item.label} to={item.to} className={`adm-nav-item ${location.pathname === item.to ? "adm-nav-active" : ""}`}><span className="adm-nav-icon">{item.icon}</span>{item.label}</Link>)}
        </nav>
        <div className="adm-sidebar-bottom">
          <div className="adm-user-row"><div className="adm-avatar">{user?.name?.[0] ?? "A"}</div><div><div className="adm-user-name">{user?.name ?? "Administrator"}</div><div className="adm-user-role">Super Admin</div></div></div>
          <button className="adm-logout-btn" onClick={handleLogout}><FaSignOutAlt /> Log out</button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-topbar">
          <div><h1 className="adm-heading">{title}</h1>{subtitle && <p className="adm-sub">{subtitle}</p>}</div>
          <div className="adm-notif-wrap">
            <button className="adm-notif" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={notificationsOpen} onClick={toggleNotifications}>
              <FaBell />
              {unreadCount > 0 && <span className="adm-notif-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <section className="adm-notif-panel">
                <header><div><strong>Notifications</strong><small>New account registrations</small></div><span>{notifications.length}</span></header>
                <div className="adm-notif-list">
                  {notifications.map((item) => <Link to={item.role === "tutor" ? "/admin-dashboard/tutors" : "/admin-dashboard/students"} className="adm-notif-item" key={item.id} onClick={() => setNotificationsOpen(false)}><span className="adm-notif-avatar">{item.detail.charAt(0).toUpperCase()}</span><span><strong>{item.title}</strong><small>{item.detail}</small><time>{formatAdminDate(item.createdAt)}</time></span></Link>)}
                  {!notifications.length && <p className="adm-empty">No signup notifications yet.</p>}
                </div>
              </section>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

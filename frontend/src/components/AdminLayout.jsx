import { Link, useLocation } from "react-router-dom";
import { FaChartBar, FaChalkboardTeacher, FaUsers,
         FaBookOpen, FaFileAlt, FaCog, FaSignOutAlt, FaBell } from "react-icons/fa";
import "../styles/AdminLayout.css";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user")); }
  catch { return null; }
}

const NAV = [
  { icon: <FaChartBar />,          label: "Overview",  to: "/admin-dashboard"          },
  { icon: <FaChalkboardTeacher />, label: "Tutors",    to: "/admin-dashboard/tutors"   },
  { icon: <FaUsers />,             label: "Students",  to: "/admin-dashboard/students" },
  { icon: <FaBookOpen />,          label: "Courses",   to: "/admin-dashboard/courses"  },
  { icon: <FaFileAlt />,           label: "Reports",   to: "/admin-dashboard/reports"  },
  { icon: <FaCog />,               label: "Settings",  to: "/admin-dashboard/settings" },
];

export default function AdminLayout({ children, title, subtitle }) {
  const user     = getStoredUser();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/auth";
  };

  return (
    <div className="adm-shell">

      {/* ── Sidebar ── */}
      <aside className="adm-sidebar">
        <div className="adm-logo">
          <span className="adm-edu">EDU</span>
          <span className="adm-nova">NOVA</span>
          <span className="adm-badge">ADMIN</span>
        </div>

        <nav className="adm-nav">
          {NAV.map(n => (
            <Link
              key={n.label}
              to={n.to}
              className={`adm-nav-item ${location.pathname === n.to ? "adm-nav-active" : ""}`}
            >
              <span className="adm-nav-icon">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="adm-sidebar-bottom">
          <div className="adm-user-row">
            <div className="adm-avatar">{user?.name?.[0] ?? "A"}</div>
            <div>
              <div className="adm-user-name">{user?.name ?? "Administrator"}</div>
              <div className="adm-user-role">Super Admin</div>
            </div>
          </div>
          <button className="adm-logout-btn" onClick={handleLogout}>
            <FaSignOutAlt /> Log out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="adm-main">
        <div className="adm-topbar">
          <div>
            <h1 className="adm-heading">{title}</h1>
            {subtitle && <p className="adm-sub">{subtitle}</p>}
          </div>
          <button className="adm-notif">
            <FaBell />
            <span className="adm-notif-dot" />
          </button>
        </div>
        {children}
      </main>

    </div>
  );
}

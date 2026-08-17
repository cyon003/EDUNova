import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaChevronDown,
  FaBullhorn,
  FaGraduationCap,
  FaSearch,
  FaSignOutAlt,
  FaTimes,
} from "react-icons/fa";
import Home from "./Home";
import "../styles/UserHome.css";
import LanguagePreference from "../components/LanguagePreference";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getInitials(name) {
  if (!name) return "U";

  return name
    .trim()
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getDashboardPath(role) {
  if (role === "admin") return "/admin-dashboard";
  if (role === "tutor") return "/tutor-dashboard";
  return "/student-dashboard";
}

function UserHome() {
  const navigate = useNavigate();
  const [user] = useState(() => getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`edunova-dismissed-announcements-${user?.id || "user"}`)) || []; }
    catch { return []; }
  });

  useEffect(() => {
    if (!user) {
      window.location.href = "/auth";
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("http://localhost:5050/api/announcements", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load announcements")))
      .then(setAnnouncements)
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/";
  };
  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    navigate(query ? `/courses?search=${encodeURIComponent(query)}` : "/courses");
  };

  if (!user) return null;

  const dashboardPath = getDashboardPath(user.role);
  const visibleAnnouncements = announcements.filter((item) => !dismissedAnnouncements.includes(item._id));
  const activeAnnouncement = visibleAnnouncements[0];
  const dismissAnnouncement = (id) => {
    const updated = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(updated);
    localStorage.setItem(`edunova-dismissed-announcements-${user?.id || "user"}`, JSON.stringify(updated));
  };

  const navigation = (
    <>
      <nav className="uhome-nav">
        <Link to="/home#top" className="uhome-logo" aria-label="EDUNOVA Home">
          <span className="uhome-brand-icon">
            <FaGraduationCap />
          </span>
          <span className="uhome-brand">EDUNOVA</span>
        </Link>

        <div className="uhome-nav-center">
          <Link
            to="/home#top"
            className={activeTab === "home" ? "active" : undefined}
            aria-current={activeTab === "home" ? "page" : undefined}
            onClick={() => setActiveTab("home")}
            onFocus={() => setActiveTab("home")}
          >
            Home
          </Link>
          <Link
            to="/home#courses"
            className={activeTab === "courses" ? "active" : undefined}
            aria-current={activeTab === "courses" ? "page" : undefined}
            onClick={() => setActiveTab("courses")}
            onFocus={() => setActiveTab("courses")}
          >
            Courses
          </Link>
          <Link
            to="/ai-chatbot"
            className={activeTab === "chatbot" ? "active" : undefined}
            onClick={() => setActiveTab("chatbot")}
            onFocus={() => setActiveTab("chatbot")}
          >
            AI Chatbot
          </Link>
          <Link
            to={dashboardPath}
            className={activeTab === "dashboard" ? "active" : undefined}
            onClick={() => setActiveTab("dashboard")}
            onFocus={() => setActiveTab("dashboard")}
          >
            My Dashboard
          </Link>
        </div>

        <div className="uhome-nav-right">
          <LanguagePreference />
          <form className="uhome-nav-search" onSubmit={submitSearch}>
            <FaSearch aria-hidden="true" />
            <input
              type="search"
              aria-label="Search courses"
              placeholder="Search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </form>

          <div className="uhome-profile-menu">
            <button
              className="uhome-profile-trigger"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Profile menu"
            >
              <span className="uhome-avatar">{getInitials(user.name)}</span>
              <span className="uhome-profile-name">Profile</span>
              <FaChevronDown
                className={`uhome-chevron ${menuOpen ? "open" : ""}`}
              />
            </button>

            {menuOpen && (
              <div className="uhome-profile-dropdown">
                <div className="uhome-profile-header">
                  <span className="uhome-avatar uhome-avatar-large">
                    {getInitials(user.name)}
                  </span>
                  <div>
                    <p className="uhome-user-name">{user.name || "User"}</p>
                    <p className="uhome-user-email">{user.email}</p>
                  </div>
                </div>

                <Link to={dashboardPath}>My Dashboard</Link>
                {user.role === "student" && <Link to="/my-courses">My Courses</Link>}
                <button type="button" onClick={handleLogout}>
                  <FaSignOutAlt /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      {activeAnnouncement && <aside className="uhome-announcement" aria-live="polite"><span className="uhome-announcement-icon"><FaBullhorn /></span><div><strong>Announcement</strong><p>{activeAnnouncement.title}</p></div>{visibleAnnouncements.length > 1 && <small>{visibleAnnouncements.length} new</small>}<button type="button" aria-label="Dismiss announcement" onClick={() => dismissAnnouncement(activeAnnouncement._id)}><FaTimes /></button></aside>}
    </>
  );

  return <Home navigation={navigation} showFooter={false} dashboardPath={dashboardPath} />;
}

export default UserHome;

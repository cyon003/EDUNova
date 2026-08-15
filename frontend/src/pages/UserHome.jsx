import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBell,
  FaChevronDown,
  FaGraduationCap,
  FaSearch,
  FaSignOutAlt,
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

function UserHome() {
  const [user] = useState(() => getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    if (!user) {
      window.location.href = "/auth";
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (!user) return null;

  const navigation = (
      <nav className="uhome-nav">
        <a href="/" className="uhome-logo" aria-label="EDUNOVA Home">
          <span className="uhome-brand-icon">
            <FaGraduationCap />
          </span>
          <span className="uhome-brand">EDUNOVA</span>
        </a>

        <div className="uhome-nav-center">
          <a
            href="/"
            className={activeTab === "home" ? "active" : undefined}
            aria-current={activeTab === "home" ? "page" : undefined}
            onClick={() => setActiveTab("home")}
            onFocus={() => setActiveTab("home")}
          >
            Home
          </a>
          <a
            href="#courses"
            className={activeTab === "courses" ? "active" : undefined}
            aria-current={activeTab === "courses" ? "page" : undefined}
            onClick={() => setActiveTab("courses")}
            onFocus={() => setActiveTab("courses")}
          >
            Courses
          </a>
          <Link
            to="/ai-chatbot"
            className={activeTab === "chatbot" ? "active" : undefined}
            onClick={() => setActiveTab("chatbot")}
            onFocus={() => setActiveTab("chatbot")}
          >
            AI Chatbot
          </Link>
          <Link
            to="/ranking"
            className={activeTab === "ranking" ? "active" : undefined}
            onClick={() => setActiveTab("ranking")}
            onFocus={() => setActiveTab("ranking")}
          >
            Ranking
          </Link>
          <Link
            to="/student-dashboard"
            className={activeTab === "dashboard" ? "active" : undefined}
            onClick={() => setActiveTab("dashboard")}
            onFocus={() => setActiveTab("dashboard")}
          >
            My Dashboard
          </Link>
        </div>

        <div className="uhome-nav-right">
          <LanguagePreference />
          <label className="uhome-nav-search">
            <FaSearch aria-hidden="true" />
            <input
              type="search"
              aria-label="Search courses"
              placeholder="Search"
            />
          </label>

          <button className="uhome-icon-btn" type="button" aria-label="Notifications">
            <FaBell />
            <span className="uhome-notification-dot" />
          </button>

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

                <a href="#profile">My Profile</a>
                <a href="#settings">Settings</a>
                <button type="button" onClick={handleLogout}>
                  <FaSignOutAlt /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
  );

  return <Home navigation={navigation} showFooter={false} />;
}

export default UserHome;

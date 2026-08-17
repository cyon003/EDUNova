import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
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
  const navigate = useNavigate();
  const [user] = useState(() => getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");

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
  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    navigate(query ? `/courses?search=${encodeURIComponent(query)}` : "/courses");
  };

  if (!user) return null;

  const navigation = (
      <nav className="uhome-nav">
        <Link to="/#top" className="uhome-logo" aria-label="EDUNOVA Home">
          <span className="uhome-brand-icon">
            <FaGraduationCap />
          </span>
          <span className="uhome-brand">EDUNOVA</span>
        </Link>

        <div className="uhome-nav-center">
          <Link
            to="/#top"
            className={activeTab === "home" ? "active" : undefined}
            aria-current={activeTab === "home" ? "page" : undefined}
            onClick={() => setActiveTab("home")}
            onFocus={() => setActiveTab("home")}
          >
            Home
          </Link>
          <Link
            to="/#courses"
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

                <Link to="/student-dashboard">My Dashboard</Link>
                <Link to="/my-courses">My Courses</Link>
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

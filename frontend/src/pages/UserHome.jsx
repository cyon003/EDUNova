import { useEffect, useState } from "react";
import "../styles/UserHome.css";
import {
  FaGraduationCap,
  FaSearch,
  FaFire,
  FaTrophy,
  FaBookOpen,
  FaSignOutAlt,
  FaBell,
  FaBolt,
  FaLaptopCode,
  FaPaintBrush,
  FaRobot,
  FaArrowRight,
  FaChevronDown,
} from "react-icons/fa";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

const continueLearning = [
  {
    icon: <FaLaptopCode />,
    title: "Web Development",
    lesson: "Lesson 8: React Hooks",
    progress: 62,
  },
  {
    icon: <FaRobot />,
    title: "Artificial Intelligence",
    lesson: "Lesson 3: Neural Networks",
    progress: 28,
  },
  {
    icon: <FaPaintBrush />,
    title: "UI / UX Design",
    lesson: "Lesson 5: Design Systems",
    progress: 90,
  },
];

const recommended = [
  { icon: <FaBolt />, title: "Data Science", desc: "Turn raw data into decisions that matter." },
  { icon: <FaGraduationCap />, title: "Public Speaking", desc: "Present ideas with clarity and confidence." },
  { icon: <FaTrophy />, title: "Competitive Coding", desc: "Sharpen problem solving under time pressure." },
];

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
  // const [user] = useState(() => getStoredUser());
  const [user] = useState(() => getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      window.location.href = "/auth";
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const firstName = user?.name ? user.name.split(" ")[0] : "there";

  if (!user) return null;

  return (
    <div className="uhome">
      <div className="uhome-glow uhome-glow-1" />
      <div className="uhome-glow uhome-glow-2" />

      <div className="uhome-content">
        <nav className="uhome-nav">
          <div className="logo">
            <div className="uhome-brand-icon">
              <FaGraduationCap />
            </div>
            <h2 className="uhome-brand">EDUNOVA</h2>
          </div>

          <div className="uhome-nav-center">
            <a href="#" className="active">Home</a>
            <a href="#">Courses</a>
            <a href="#">Categories</a>
            <a href="#">AI Chatbot</a>
            <a href="#">Ranking</a>
          </div>

          <div className="uhome-nav-right">
            <button className="icon-btn" aria-label="Notifications">
              <FaBell />
              <span className="dot" />
            </button>

            <div className="profile-menu">
              <button
                className="profile-trigger"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="avatar">{getInitials(user?.name)}</span>
                <span className="profile-name">{firstName}</span>
                <FaChevronDown className={`chev ${menuOpen ? "open" : ""}`} />
              </button>

              {menuOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <span className="avatar avatar-lg">{getInitials(user?.name)}</span>
                    <div>
                      <p className="pd-name">{user?.name || "User"}</p>
                      <p className="pd-email">{user?.email}</p>
                    </div>
                  </div>
                  <a href="#">My Profile</a>
                  <a href="#">Settings</a>
                  <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <section className="uhero">
          <div className="uhero-text">
            <span className="eyebrow">Welcome back</span>
            <h1>
              Hey {firstName}, ready to <span>level up</span> today?
            </h1>
            <p>Pick up where you left off, or explore something new.</p>

            <div className="search-box">
              <input type="text" placeholder="Search for courses..." />
              <button>
                <FaSearch />
              </button>
            </div>
          </div>

          <div className="uhero-stats">
            <div className="ustat">
              <FaFire />
              <div>
                <h3>12</h3>
                <p>Day streak</p>
              </div>
            </div>
            <div className="ustat">
              <FaBookOpen />
              <div>
                <h3>3</h3>
                <p>Courses in progress</p>
              </div>
            </div>
            <div className="ustat">
              <FaTrophy />
              <div>
                <h3>#48</h3>
                <p>Global rank</p>
              </div>
            </div>
          </div>
        </section>

        <section className="usection">
          <div className="usection-head">
            <h2>Continue Learning</h2>
            <a href="#" className="see-all">
              See all <FaArrowRight />
            </a>
          </div>

          <div className="continue-grid">
            {continueLearning.map((course, i) => (
              <div
                className="continue-card"
                key={course.title}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="cc-icon">{course.icon}</div>
                <h3>{course.title}</h3>
                <p>{course.lesson}</p>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
                <span className="progress-label">{course.progress}% complete</span>
              </div>
            ))}
          </div>
        </section>

        <section className="usection">
          <div className="usection-head">
            <h2>Recommended for you</h2>
            <a href="#" className="see-all">
              See all <FaArrowRight />
            </a>
          </div>

          <div className="rec-grid">
            {recommended.map((course, i) => (
              <div
                className="rec-card"
                key={course.title}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="cc-icon">{course.icon}</div>
                <h3>{course.title}</h3>
                <p>{course.desc}</p>
                <div className="card-link">
                  <span>Start course</span>
                  <FaArrowRight />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="uquick">
          <a href="#" className="uquick-card">
            <FaTrophy />
            <div>
              <h3>Ranking</h3>
              <p>See how you stack up this week</p>
            </div>
          </a>
          <a href="#" className="uquick-card">
            <FaRobot />
            <div>
              <h3>AI Chatbot</h3>
              <p>Ask questions, get instant help</p>
            </div>
          </a>
          <a href="#" className="uquick-card">
            <FaBookOpen />
            <div>
              <h3>Categories</h3>
              <p>Browse every learning path</p>
            </div>
          </a>
        </section>
      </div>
    </div>
  );
}

export default UserHome;

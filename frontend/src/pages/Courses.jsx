import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Courses.css";

const NAV = [
  { icon: "▦", label: "Dashboard",  to: "/dashboard" },
  { icon: "◫", label: "All Courses", to: "/courses", active: true },
  { icon: "⊞", label: "Resources",  to: "/resources" },
  { icon: "◯", label: "Friends",    to: "/friends" },
  { icon: "✉", label: "Chats",      to: "/chats" },
  { icon: "⚙", label: "Settings",   to: "/settings" },
];

const TABS = ["Ongoing", "Favourite", "Complete"];

const INITIAL_COURSES = [
  {
    id: 1,
    title: "UI/UX Design",
    lessons: 20,
    duration: "2h 20min",
    level: "Advanced",
    category: "UI/UX",
    progress: 74,
    bg: "linear-gradient(135deg, #5A4FCF 0%, #7C6FE0 100%)",
    wide: true,
  },
  {
    id: 2,
    title: "Python Basics",
    lessons: 24,
    duration: "1h 45min",
    level: "Beginner",
    category: "Python",
    progress: 30,
    bg: "linear-gradient(135deg, #00D5F7 0%, #0098c7 100%)",
    wide: false,
  },
  {
    id: 3,
    title: "Machine Learning",
    lessons: 36,
    duration: "2h 30min",
    level: "Intermediate",
    category: "AI & ML",
    progress: 0,
    bg: "linear-gradient(135deg, #FBBF24 0%, #f59e0b 100%)",
    wide: false,
  },
  {
    id: 4,
    title: "Full-Stack Web Dev",
    lessons: 52,
    duration: "3h 10min",
    level: "Intermediate",
    category: "Web Dev",
    progress: 100,
    bg: "linear-gradient(135deg, #34D399 0%, #059669 100%)",
    wide: false,
  },
  {
    id: 5,
    title: "Cybersecurity",
    lessons: 44,
    duration: "2h 50min",
    level: "Advanced",
    category: "Security",
    progress: 0,
    bg: "linear-gradient(135deg, #F87171 0%, #dc2626 100%)",
    wide: false,
  },
  {
    id: 6,
    title: "Data Visualization",
    lessons: 18,
    duration: "1h 20min",
    level: "Intermediate",
    category: "Data",
    progress: 0,
    bg: "linear-gradient(135deg, #A78BFA 0%, #7c3aed 100%)",
    wide: false,
  },
  {
    id: 7,
    title: "React Development",
    lessons: 28,
    duration: "2h 10min",
    level: "Intermediate",
    category: "React",
    progress: 0,
    bg: "linear-gradient(135deg,#4facfe,#00f2fe)",
    wide: false,
  },
  {
    id: 8,
    title: "AWS Cloud",
    lessons: 30,
    duration: "2h 15min",
    level: "Intermediate",
    category: "Cloud",
    progress: 0,
    bg: "linear-gradient(135deg,#ffb347,#ffcc33)",
    wide: false,
  },
  {
    id: 9,
    title: "Docker Essentials",
    lessons: 22,
    duration: "1h 55min",
    level: "Beginner",
    category: "DevOps",
    progress: 0,
    bg: "linear-gradient(135deg,#667eea,#764ba2)",
    wide: false,
  },
];

const PROGRESS_COURSES = [
  { label: "UI/UX Design",  sub: "Advanced",     pct: 74,  color: "#5A4FCF" },
  { label: "Python Basics", sub: "Beginner",      pct: 30,  color: "#00D5F7" },
  { label: "ML Basics",     sub: "Intermediate",  pct: 12,  color: "#FBBF24" },
];

const TASKS = [
  { title: "UI/UX – Discussion",     date: "Mon, 7 Jul 2025", icon: "✉" },
  { title: "ML – Model Evaluation",  date: "Wed, 9 Jul 2025", icon: "⊞" },
];

function CourseCard({ course, tab, isFav, onToggleFav }) {
  const showProgress = course.progress > 0;
  const [animateBurst, setAnimateBurst] = useState(false);

  const handleFavClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAnimateBurst(true);
    onToggleFav(course.id);
    setTimeout(() => setAnimateBurst(false), 400);
  };

  return (
    <div className={`course-card ${course.wide ? "course-card-wide" : ""}`}>
      {/* Dynamic 3D Highlight Shine Layer */}
      <div className="card-3d-shine" />
      
      <div className="course-thumb" style={{ background: course.bg }}>
        <div className="thumb-overlay">
          <div className="thumb-top">
            <span className="thumb-cat">{course.category}</span>
            <button 
              className={`thumb-fav-btn ${isFav ? "is-active" : ""} ${animateBurst ? "pop-burst" : ""}`}
              onClick={handleFavClick}
              aria-label="Toggle Favourite"
            >
              <svg viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
          <div className="thumb-bottom">
            <div className="thumb-play">▶</div>
          </div>
        </div>
        <div className="thumb-shape shape-a" />
        <div className="thumb-shape shape-b" />
      </div>
      <div className="course-body">
        <div className="course-body-top">
          <div>
            <h3 className="course-title">{course.title}</h3>
            <span className="course-meta">{course.lessons} lessons · {course.level}</span>
          </div>
        </div>
        {showProgress ? (
          <div className="card-progress">
            <div className="card-progress-bar">
              <div className="card-progress-fill" style={{ width: `${course.progress}%`, background: course.bg }} />
            </div>
            <span className="card-progress-pct">{course.progress}%</span>
          </div>
        ) : (
          <button className="btn-enroll">Enroll Now</button>
        )}
      </div>
    </div>
  );
}

export default function Courses() {
  const [tab, setTab] = useState("Ongoing");
  const [search, setSearch] = useState("");
  const [favIds, setFavIds] = useState([1, 3]); 

  const toggleFav = (id) => {
    setFavIds(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]);
  };

  const visible = INITIAL_COURSES.filter(c => {
    if (tab === "Favourite") return favIds.includes(c.id);
    if (tab === "Complete")  return c.progress === 100;
    return c.progress < 100;
  }).filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="cp-shell">
      <aside className="cp-sidebar">
        <Link to="/" className="cp-logo">
          <span className="edu">EDU</span><span className="nova">NOVA</span>
        </Link>
        <button className="btn-join">+ Join a Course</button>
        <nav className="cp-nav">
          {NAV.map(n => (
            <Link key={n.label} to={n.to} className={`cp-nav-item ${n.active ? "cp-nav-active" : ""}`}>
              <span className="cp-nav-icon">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="cp-upgrade-box">
          <div className="upgrade-icon">📁</div>
          <p>Upgrade for more resources</p>
          <button className="btn-upgrade">Upgrade</button>
        </div>
      </aside>

      <main className="cp-main">
        <div className="cp-topbar">
          <div className="cp-search">
            <span className="cp-search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search courses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="cp-search-input"
            />
          </div>
          <div className="cp-topbar-right">
            <button className="icon-btn">🔔</button>
          </div>
        </div>

        <div className="cp-heading-row">
          <h1 className="cp-heading">All Courses</h1>
          <div className="cp-tabs">
            {TABS.map(t => (
              <button
                key={t}
                className={`cp-tab ${tab === t ? "cp-tab-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="cp-grid">
            {visible.map(c => (
              <CourseCard 
                key={c.id} 
                course={c} 
                tab={tab} 
                isFav={favIds.includes(c.id)}
                onToggleFav={toggleFav}
              />
            ))}
          </div>
        ) : (
          <div className="cp-empty">
            <p>No courses here yet.</p>
            <button className="btn-enroll" onClick={() => { setTab("Ongoing"); setSearch(""); }}>
              Browse all courses
            </button>
          </div>
        )}
      </main>

      <aside className="cp-right">
        <div className="cp-user">
          <div className="cp-avatar">A</div>
          <div>
            <div className="cp-user-name">Alex Nova</div>
            <div className="cp-user-plan">Free Plan</div>
          </div>
          <span className="cp-user-arrow">⌄</span>
        </div>

        <div className="cp-section-title">Progress</div>
        <div className="cp-progress-list">
          {PROGRESS_COURSES.map(p => (
            <div className="cp-prog-item" key={p.label}>
              <div className="cp-prog-dot" style={{ background: p.color }} />
              <div className="cp-prog-info">
                <div className="cp-prog-label">{p.label}</div>
                <div className="cp-prog-sub">{p.sub}</div>
                <div className="cp-prog-bar">
                  <div className="cp-prog-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
              </div>
              <span className="cp-prog-pct">{p.pct}%</span>
            </div>
          ))}
        </div>

        <div className="cp-section-title" style={{ marginTop: 28 }}>Upcoming Tasks</div>
        <div className="cp-tasks">
          {TASKS.map(t => (
            <div className="cp-task" key={t.title}>
              <div className="cp-task-icon">{t.icon}</div>
              <div>
                <div className="cp-task-title">{t.title}</div>
                <div className="cp-task-date">{t.date}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="cp-promo">
          <div className="cp-promo-text">
            <strong>Go Pro</strong>
            <p>Unlock all courses & AI features</p>
          </div>
          <button className="btn-upgrade-sm">Upgrade →</button>
        </div>
      </aside>
    </div>
  );
}
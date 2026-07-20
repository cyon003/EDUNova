import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Profile.css";

/* ── Radar Chart (pure SVG) ── */
function RadarChart({ stats }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const levels = 5;
  const keys = Object.keys(stats);
  const n = keys.length;

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (i, radius) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });

  const gridPolygon = (level) => {
    const ratio = level / levels;
    return keys.map((_, i) => {
      const p = point(i, r * ratio);
      return `${p.x},${p.y}`;
    }).join(" ");
  };

  const dataPolygon = keys.map((k, i) => {
    const ratio = stats[k] / 100;
    const p = point(i, r * ratio);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg">
      {/* Grid */}
      {[1, 2, 3, 4, 5].map((lvl) => (
        <polygon
          key={lvl}
          points={gridPolygon(lvl)}
          fill="none"
          stroke="rgba(200,146,10,0.15)"
          strokeWidth="1"
        />
      ))}
      {/* Axes */}
      {keys.map((_, i) => {
        const p = point(i, r);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(200,146,10,0.2)" strokeWidth="1" />;
      })}
      {/* Data shape */}
      <polygon
        points={dataPolygon}
        fill="rgba(200,146,10,0.18)"
        stroke="#c8920a"
        strokeWidth="2"
      />
      {/* Dots */}
      {keys.map((k, i) => {
        const ratio = stats[k] / 100;
        const p = point(i, r * ratio);
        return <circle key={k} cx={p.x} cy={p.y} r="4" fill="#f5b913" stroke="#1f1600" strokeWidth="1.5" />;
      })}
      {/* Labels */}
      {keys.map((k, i) => {
        const p = point(i, r + 20);
        return (
          <text key={k} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="700" fill="#f5b913" fontFamily="'Plus Jakarta Sans', sans-serif">
            {k}
          </text>
        );
      })}
      {/* Values */}
      {keys.map((k, i) => {
        const ratio = stats[k] / 100;
        const p = point(i, r * ratio - 14);
        return (
          <text key={`v${k}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="800" fill="#fff" fontFamily="'Plus Jakarta Sans', sans-serif">
            {stats[k]}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Data ── */
const STUDENT = {
  name: "Alex Nova",
  handle: "@alexnova",
  role: "Full-Stack Learner",
  level: "Intermediate",
  xp: 4280,
  xpNext: 5000,
  joined: "Jan 2024",
  streak: 18,
  bio: "Passionate about web development and AI. Currently mastering React and diving deep into machine learning fundamentals.",
  skills: { QUZ: 87, COD: 90, SPD: 74, CON: 83, PRJ: 78, DSC: 65 },
  stats: [
    { label: "Courses Done",    value: "12",   sub: "completed" },
    { label: "Avg Score",       value: "88%",  sub: "across quizzes" },
    { label: "Hours Learned",   value: "142",  sub: "total" },
    { label: "Rank",            value: "#24",  sub: "in cohort" },
  ],
  trophies: [
    { icon: "🏆", label: "Top Scorer",      color: "#f5b913" },
    { icon: "🔥", label: "30-Day Streak",   color: "#e05050" },
    { icon: "⚡", label: "Speed Learner",   color: "#00a8b5" },
    { icon: "🎯", label: "Quiz Master",     color: "#c8920a" },
    { icon: "💡", label: "AI Explorer",     color: "#a78bfa" },
  ],
  courses: [
    { title: "UI/UX Design",       pct: 74,  color: "#c8920a",  status: "In Progress" },
    { title: "Python Basics",      pct: 100, color: "#34D399",  status: "Completed"   },
    { title: "Machine Learning",   pct: 30,  color: "#00a8b5",  status: "In Progress" },
    { title: "Cybersecurity",      pct: 0,   color: "#e05050",  status: "Not Started" },
  ],
};

const TABS = ["Overview", "Courses", "Achievements"];

export default function Profile() {
  const [tab, setTab] = useState("Overview");

  const xpPct = Math.round((STUDENT.xp / STUDENT.xpNext) * 100);

  return (
    <div className="profile-shell">

      {/* ── Sidebar ── */}
      <aside className="prof-sidebar">
        <Link to="/" className="prof-logo">
          <span className="edu">EDU</span><span className="nova">NOVA</span>
        </Link>
        <nav className="prof-nav">
          {[
            { icon: "⌂",  label: "Home",      to: "/" },
            { icon: "◫",  label: "Courses",   to: "/courses" },
            { icon: "▦",  label: "Dashboard", to: "/dashboard" },
            { icon: "✦",  label: "AI Tutor",  to: "/ai" },
            { icon: "◯",  label: "Profile",   to: "/profile", active: true },
          ].map(n => (
            <Link key={n.label} to={n.to} className={`prof-nav-item ${n.active ? "prof-nav-active" : ""}`}>
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="prof-main">

        {/* Hero band */}
        <div className="prof-hero">
          <div className="prof-hero-bg" />

          <div className="prof-hero-content">
            <div className="prof-avatar-wrap">
              <div className="prof-avatar">AN</div>
              <div className="prof-level-badge">{STUDENT.level}</div>
            </div>

            <div className="prof-hero-info">
              <div className="prof-role">{STUDENT.role}</div>
              <h1 className="prof-name">{STUDENT.name}</h1>
              <div className="prof-handle">{STUDENT.handle} · Joined {STUDENT.joined}</div>

              {/* XP bar */}
              <div className="prof-xp-wrap">
                <div className="prof-xp-labels">
                  <span>XP {STUDENT.xp.toLocaleString()}</span>
                  <span>{xpPct}% to next level</span>
                </div>
                <div className="prof-xp-track">
                  <div className="prof-xp-fill" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            </div>

            {/* Trophies */}
            <div className="prof-trophies">
              {STUDENT.trophies.map(t => (
                <div className="prof-trophy" key={t.label} title={t.label}>
                  <div className="trophy-icon" style={{ boxShadow: `0 0 14px ${t.color}55` }}>
                    {t.icon}
                  </div>
                  <span className="trophy-label">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="prof-tabs">
          {TABS.map(t => (
            <button key={t} className={`prof-tab ${tab === t ? "prof-tab-active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "Overview" && (
          <div className="prof-overview">

            {/* Stat cards */}
            <div className="prof-stats-row">
              {STUDENT.stats.map(s => (
                <div className="prof-stat-card" key={s.label}>
                  <div className="prof-stat-value">{s.value}</div>
                  <div className="prof-stat-label">{s.label}</div>
                  <div className="prof-stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="prof-body">

              {/* Left — Bio + Skill bars */}
              <div className="prof-left">
                <div className="prof-card">
                  <div className="prof-card-title">About</div>
                  <p className="prof-bio">{STUDENT.bio}</p>

                  <div className="prof-card-title" style={{ marginTop: 24 }}>Streak</div>
                  <div className="streak-row">
                    <div className="streak-fire">🔥</div>
                    <div>
                      <div className="streak-num">{STUDENT.streak} days</div>
                      <div className="streak-sub">Keep it going!</div>
                    </div>
                  </div>
                </div>

                <div className="prof-card">
                  <div className="prof-card-title">Skill Breakdown</div>
                  <div className="skill-bars">
                    {[
                      { label: "Quiz Performance",   pct: 87, color: "#f5b913" },
                      { label: "Coding Exercises",   pct: 90, color: "#00a8b5" },
                      { label: "Project Work",       pct: 78, color: "#c8920a" },
                      { label: "Discussion",         pct: 65, color: "#a78bfa" },
                      { label: "Consistency",        pct: 83, color: "#34D399" },
                    ].map(s => (
                      <div className="skill-bar-item" key={s.label}>
                        <div className="skill-bar-header">
                          <span>{s.label}</span>
                          <span style={{ color: s.color }}>{s.pct}</span>
                        </div>
                        <div className="skill-bar-track">
                          <div className="skill-bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — Radar + Current courses */}
              <div className="prof-right">
                <div className="prof-card radar-card">
                  <div className="prof-card-title">Learning Radar</div>
                  <div className="radar-wrap">
                    <RadarChart stats={STUDENT.skills} />
                  </div>
                  <div className="radar-legend">
                    <span>QUZ = Quiz</span><span>COD = Coding</span>
                    <span>SPD = Speed</span><span>CON = Consistency</span>
                    <span>PRJ = Projects</span><span>DSC = Discussion</span>
                  </div>
                </div>

                <div className="prof-card">
                  <div className="prof-card-title">Current Courses</div>
                  <div className="prof-course-list">
                    {STUDENT.courses.map(c => (
                      <div className="prof-course-item" key={c.title}>
                        <div className="prof-course-dot" style={{ background: c.color }} />
                        <div className="prof-course-info">
                          <div className="prof-course-name">{c.title}</div>
                          <div className="prof-course-bar-track">
                            <div className="prof-course-bar-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                          </div>
                        </div>
                        <span className="prof-course-pct" style={{ color: c.color }}>{c.pct}%</span>
                        <span className={`prof-course-status status-${c.status.replace(" ", "-").toLowerCase()}`}>{c.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── COURSES TAB ── */}
        {tab === "Courses" && (
          <div className="prof-tab-content">
            <div className="prof-courses-grid">
              {STUDENT.courses.map(c => (
                <div className="prof-course-card" key={c.title} style={{ "--accent": c.color }}>
                  <div className="prof-course-card-top">
                    <span className="prof-course-card-title">{c.title}</span>
                    <span className={`prof-course-status status-${c.status.replace(" ", "-").toLowerCase()}`}>{c.status}</span>
                  </div>
                  <div className="prof-course-card-bar-track">
                    <div className="prof-course-card-bar-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                  </div>
                  <div className="prof-course-card-pct" style={{ color: c.color }}>{c.pct}% complete</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACHIEVEMENTS TAB ── */}
        {tab === "Achievements" && (
          <div className="prof-tab-content">
            <div className="prof-achievements-grid">
              {[
                ...STUDENT.trophies,
                { icon: "📚", label: "10 Courses",    color: "#c8920a" },
                { icon: "🧠", label: "100 Hrs",       color: "#a78bfa" },
                { icon: "🥇", label: "Perfect Quiz",  color: "#f5b913" },
                { icon: "🤝", label: "Peer Helper",   color: "#34D399" },
              ].map((t, i) => (
                <div className="achievement-card" key={i} style={{ "--acolor": t.color }}>
                  <div className="achievement-icon">{t.icon}</div>
                  <div className="achievement-label">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

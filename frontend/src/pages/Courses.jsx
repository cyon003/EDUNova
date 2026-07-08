import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/Courses.css";

/* ─────────────────────────────────────────
   3D Tilt Hook
───────────────────────────────────────── */
function useTilt(strength = 8) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const orb = el.querySelector(".cell-orb");

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -strength;
      const rotY = ((x - cx) / cx) * strength;
      el.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px) scale(1.02)`;
      el.style.boxShadow = `${-rotY * 1.5}px ${rotX * 1.5}px 40px rgba(200,146,10,0.45), 0 20px 60px rgba(0,0,0,0.5)`;
      if (orb) {
        orb.style.opacity = "1";
        orb.style.left = `${x - 100}px`;
        orb.style.top  = `${y - 100}px`;
      }
    };
    const onLeave = () => {
      el.style.transform = "";
      el.style.boxShadow = "";
      if (orb) orb.style.opacity = "0";
    };
    const onDown = () => { el.style.transform = "perspective(700px) scale(0.97)"; };
    const onUp   = (e) => onMove(e);

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mouseup", onUp);
    };
  }, [strength]);
  return ref;
}

function TiltCell({ className, children }) {
  const ref = useTilt(8);
  return (
    <div className={`bento-cell ${className}`} ref={ref}>
      <div className="cell-orb" />
      <div className="cell-corner tl" />
      <div className="cell-corner tr" />
      <div className="cell-corner bl" />
      <div className="cell-corner br" />
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────
   Static Data
───────────────────────────────────────── */
const NAV = [
  { icon: "▦", label: "Dashboard",   to: "/dashboard" },
  { icon: "◫", label: "All Courses", to: "/courses", active: true },
  { icon: "⊞", label: "Resources",   to: "/resources" },
  { icon: "◯", label: "Friends",     to: "/friends" },
  { icon: "✉", label: "Chats",       to: "/chats" },
  { icon: "⚙", label: "Settings",    to: "/settings" },
];

const TABS = ["Ongoing", "Favourite", "Complete"];

const ALL_COURSES = [
  { id: 1, title: "UI/UX Design",       cat: "UI/UX",    sub: "20 lessons · Advanced",    bg: "linear-gradient(145deg,#7c5c00,#c8920a)" },
  { id: 2, title: "Python Basics",      cat: "Python",   sub: "24 lessons · Beginner",    bg: "linear-gradient(145deg,#005f6b,#00a8b5)" },
  { id: 3, title: "Machine Learning",   cat: "AI & ML",  sub: "36 lessons · Intermediate",bg: "linear-gradient(145deg,#5a3e00,#c8920a)" },
  { id: 4, title: "Full-Stack Web Dev", cat: "Web Dev",  sub: "52 lessons · Intermediate",bg: "linear-gradient(145deg,#1a4d2e,#34D399)" },
  { id: 5, title: "Cybersecurity",      cat: "Security", sub: "44 lessons · Advanced",    bg: "linear-gradient(145deg,#6b1a1a,#e05050)" },
];

const PROGRESS_COURSES = [
  { label: "UI/UX Design",  sub: "Advanced",     pct: 74, color: "#c8920a" },
  { label: "Python Basics", sub: "Beginner",     pct: 30, color: "#f5b913" },
  { label: "ML Basics",     sub: "Intermediate", pct: 12, color: "#e07070" },
];

const TASKS = [
  { title: "UI/UX – Discussion",    date: "Mon, 7 Jul 2025", icon: "✉" },
  { title: "ML – Model Evaluation", date: "Wed, 9 Jul 2025", icon: "⊞" },
];

/* ─────────────────────────────────────────
   Shared Heart Button
───────────────────────────────────────── */
function HeartBtn({ id, favourites, toggleFav }) {
  const active = favourites.includes(id);
  return (
    <button
      className={`fav-btn ${active ? "fav-active" : ""}`}
      onClick={(e) => { e.stopPropagation(); toggleFav(id); }}
    >
      {active ? "♥" : "♡"}
    </button>
  );
}

/* ─────────────────────────────────────────
   Ongoing Grid
───────────────────────────────────────── */
function OngoingGrid({ favourites, toggleFav }) {
  return (
    <div className="bento-mosaic">

      {/* A — UI/UX hero */}
      <TiltCell className="cell-a">
        <div className="cell-bg" style={{ background: "linear-gradient(145deg,#7c5c00,#c8920a)" }} />
        <div className="cell-shapes">
          <div className="bg-circle circle-1" /><div className="bg-circle circle-2" />
        </div>
        <div className="cell-content">
          <div className="cell-tag-row">
            <span className="cell-tag">UI/UX</span>
            <HeartBtn id={1} favourites={favourites} toggleFav={toggleFav} />
          </div>
          <div className="cell-spacer" />
          <h2 className="cell-title-lg">UI/UX Design</h2>
          <p className="cell-sub-light">20 lessons · Advanced</p>
          <div className="cell-progress-row">
            <div className="cell-bar"><div className="cell-bar-fill" style={{ width: "74%", background: "#fff" }} /></div>
            <span className="cell-pct">74%</span>
          </div>
        </div>
      </TiltCell>

      {/* B — Python */}
      <TiltCell className="cell-b">
        <div className="cell-bg" style={{ background: "linear-gradient(145deg,#005f6b,#00a8b5)" }} />
        <div className="cell-shapes"><div className="bg-circle circle-1" /></div>
        <div className="cell-content">
          <div className="cell-tag-row">
            <span className="cell-tag">Python</span>
            <HeartBtn id={2} favourites={favourites} toggleFav={toggleFav} />
          </div>
          <div className="cell-spacer" />
          <h3 className="cell-title-md">Python Basics</h3>
          <p className="cell-sub-light">24 lessons · Beginner</p>
          <div className="cell-progress-row">
            <div className="cell-bar"><div className="cell-bar-fill" style={{ width: "30%", background: "#fff" }} /></div>
            <span className="cell-pct">30%</span>
          </div>
        </div>
      </TiltCell>

      {/* C — Enrolled stat */}
      <TiltCell className="cell-c">
        <div className="cell-content cell-content-dark enrolled-cell">
          <div className="enrolled-left">
            <span className="cell-label-sm">Enrolled Courses</span>
            <div className="mini-bars">
              {[40, 65, 50, 80, 55, 70, 60].map((h, i) => (
                <div key={i} className="mini-bar" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="enrolled-right">
            <div className="cell-big-num">5</div>
            <span className="cell-sub-dark">courses</span>
          </div>
        </div>
      </TiltCell>

      {/* D — ML tall */}
      <TiltCell className="cell-d">
        <div className="cell-bg" style={{ background: "linear-gradient(145deg,#5a3e00,#c8920a)" }} />
        <div className="cell-shapes">
          <div className="bg-circle circle-1" /><div className="bg-circle circle-2" />
        </div>
        <div className="cell-content">
          <div className="cell-tag-row">
            <span className="cell-tag">AI &amp; ML</span>
            <HeartBtn id={3} favourites={favourites} toggleFav={toggleFav} />
          </div>
          <div className="cell-spacer" />
          <h3 className="cell-title-md">Machine Learning</h3>
          <p className="cell-sub-light">36 lessons · Intermediate</p>
          <button className="btn-cell-enroll">Enroll →</button>
        </div>
      </TiltCell>

      {/* E — Streak */}
      <TiltCell className="cell-e">
        <div className="cell-content cell-content-dark cell-center">
          <div className="streak-ring">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" className="ring-track" />
              <circle cx="40" cy="40" r="32" className="ring-fill-streak" />
            </svg>
            <div className="streak-inner">
              <span className="streak-num">18</span>
              <span className="streak-lbl">days</span>
            </div>
          </div>
          <p className="streak-caption" style={{ marginTop: 8 }}>Streak 🔥</p>
        </div>
      </TiltCell>

      {/* F — Web Dev wide */}
      <TiltCell className="cell-f">
        <div className="cell-bg" style={{ background: "linear-gradient(145deg,#1a4d2e,#34D399)" }} />
        <div className="cell-shapes"><div className="bg-circle circle-1" /></div>
        <div className="cell-content">
          <div className="cell-tag-row">
            <span className="cell-tag">Web Dev</span>
            <HeartBtn id={4} favourites={favourites} toggleFav={toggleFav} />
          </div>
          <div className="cell-spacer" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 className="cell-title-md">Full-Stack Web Dev</h3>
              <p className="cell-sub-light">52 lessons · Intermediate</p>
            </div>
            <button className="btn-cell-play">▶</button>
          </div>
        </div>
      </TiltCell>

      {/* G — Avg Rating */}
      <TiltCell className="cell-g">
        <div className="cell-content cell-content-dark cell-center">
          <span className="cell-label-sm">Avg Rating</span>
          <div className="cell-big-num" style={{ fontSize: 28, marginBottom: 2 }}>4.8</div>
          <div style={{ fontSize: 20, marginBottom: 4 }}>⭐</div>
          <span className="cell-sub-dark">all courses</span>
        </div>
      </TiltCell>

      {/* H — Cybersecurity */}
      <TiltCell className="cell-h">
        <div className="cell-bg" style={{ background: "linear-gradient(145deg,#6b1a1a,#e05050)" }} />
        <div className="cell-shapes">
          <div className="bg-circle circle-1" /><div className="bg-circle circle-2" />
        </div>
        <div className="cell-content">
          <div className="cell-tag-row">
            <span className="cell-tag">Security</span>
            <HeartBtn id={5} favourites={favourites} toggleFav={toggleFav} />
          </div>
          <div className="cell-spacer" />
          <h3 className="cell-title-md">Cybersecurity</h3>
          <p className="cell-sub-light">44 lessons · Advanced</p>
          <button className="btn-cell-enroll">Enroll →</button>
        </div>
      </TiltCell>

    </div>
  );
}

/* ─────────────────────────────────────────
   Favourite Grid
───────────────────────────────────────── */
const FAV_CLASSES = ["cell-fav-a", "cell-fav-b", "cell-fav-c", "cell-fav-d"];

function FavouriteGrid({ favourites, toggleFav }) {
  const favCourses = ALL_COURSES.filter(c => favourites.includes(c.id));

  if (favCourses.length === 0) {
    return (
      <div className="fav-empty">
        <div style={{ fontSize: 52, color: "#ff6b9d" }}>♡</div>
        <h3>No favourites yet</h3>
        <p>Click the ♡ on any course card to save it here</p>
      </div>
    );
  }

  return (
    <div className="bento-mosaic bento-mosaic-small">
      {favCourses.map((c, i) => (
        <TiltCell key={c.id} className={FAV_CLASSES[i] || "cell-fav-a"}>
          <div className="cell-bg" style={{ background: c.bg }} />
          <div className="cell-shapes">
            <div className="bg-circle circle-1" /><div className="bg-circle circle-2" />
          </div>
          <div className="cell-content">
            <div className="cell-tag-row">
              <span className="cell-tag">{c.cat}</span>
              <HeartBtn id={c.id} favourites={favourites} toggleFav={toggleFav} />
            </div>
            <div className="cell-spacer" />
            <h3 className="cell-title-md">{c.title}</h3>
            <p className="cell-sub-light">{c.sub}</p>
            <button className="btn-cell-enroll">Continue →</button>
          </div>
        </TiltCell>
      ))}
      {/* Stat tile */}
      <TiltCell className={FAV_CLASSES[Math.min(favCourses.length, 3)]}>
        <div className="cell-content cell-content-dark cell-center">
          <span className="cell-label-sm">Saved</span>
          <div className="cell-big-num">{favCourses.length}</div>
          <span className="cell-sub-dark">favourited</span>
        </div>
      </TiltCell>
    </div>
  );
}

/* ─────────────────────────────────────────
   Complete Grid
───────────────────────────────────────── */
function CompleteGrid() {
  return (
    <div className="bento-mosaic bento-mosaic-small">

      <TiltCell className="cell-fav-a">
        <div className="cell-bg" style={{ background: "linear-gradient(145deg,#1a4d2e,#34D399)" }} />
        <div className="cell-shapes">
          <div className="bg-circle circle-1" /><div className="bg-circle circle-2" />
        </div>
        <div className="cell-content">
          <span className="cell-tag">Web Dev</span>
          <div className="cell-spacer" />
          <h2 className="cell-title-lg">Full-Stack Web Dev</h2>
          <p className="cell-sub-light">52 lessons · Intermediate</p>
          <div className="cell-progress-row">
            <div className="cell-bar"><div className="cell-bar-fill" style={{ width: "100%", background: "#fff" }} /></div>
            <span className="cell-pct">100%</span>
          </div>
        </div>
      </TiltCell>

      <TiltCell className="cell-fav-b">
        <div className="cell-bg" style={{ background: "linear-gradient(145deg,#005f6b,#00a8b5)" }} />
        <div className="cell-shapes"><div className="bg-circle circle-1" /></div>
        <div className="cell-content">
          <span className="cell-tag">Python</span>
          <div className="cell-spacer" />
          <h3 className="cell-title-md">Python for Beginners</h3>
          <p className="cell-sub-light">18 lessons · Beginner</p>
          <div className="cell-progress-row">
            <div className="cell-bar"><div className="cell-bar-fill" style={{ width: "100%", background: "#fff" }} /></div>
            <span className="cell-pct">100%</span>
          </div>
        </div>
      </TiltCell>

      <TiltCell className="cell-fav-c">
        <div className="cell-content cell-content-dark cell-center">
          <span className="cell-label-sm">Completed</span>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#6ec97a", marginBottom: 4 }}>2 ✓</div>
          <span className="cell-sub-dark">courses finished</span>
        </div>
      </TiltCell>

      <TiltCell className="cell-fav-d">
        <div className="cell-content cell-content-dark cell-center">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <span className="cell-label-sm">Certificates</span>
          <div className="cell-big-num" style={{ fontSize: 28 }}>2</div>
        </div>
      </TiltCell>

    </div>
  );
}

/* ─────────────────────────────────────────
   Main Page
───────────────────────────────────────── */
export default function Courses() {
  const [tab, setTab]           = useState("Ongoing");
  const [favourites, setFavourites] = useState([]);

  const toggleFav = (id) =>
    setFavourites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );

  return (
    <div className="cp-shell">

      {/* ── SIDEBAR ── */}
      <aside className="cp-sidebar">
        <Link to="/" className="cp-logo">
          <span className="edu">EDU</span><span className="nova">NOVA</span>
        </Link>
        <button className="btn-join">+ Join a Course</button>
        <nav className="cp-nav">
          {NAV.map(n => (
            <Link key={n.label} to={n.to} className={`cp-nav-item ${n.active ? "cp-nav-active" : ""}`}>
              <span className="cp-nav-icon">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="cp-upgrade-box">
          <div className="upgrade-icon">📁</div>
          <p>Upgrade for more resources</p>
          <button className="btn-upgrade">Upgrade</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="cp-main">
        <div className="cp-topbar">
          <div className="cp-search">
            <span className="cp-search-icon">⌕</span>
            <input type="text" placeholder="Search courses…" className="cp-search-input" />
          </div>
          <button className="icon-btn">🔔</button>
        </div>

        <div className="cp-heading-row">
          <h1 className="cp-heading">All Courses</h1>
          <div className="cp-tabs">
            {TABS.map(t => (
              <button key={t} className={`cp-tab ${tab === t ? "cp-tab-active" : ""}`} onClick={() => setTab(t)}>
                {t}
                {t === "Favourite" && favourites.length > 0 && (
                  <span className="tab-badge">{favourites.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {tab === "Ongoing"   && <OngoingGrid   favourites={favourites} toggleFav={toggleFav} />}
        {tab === "Favourite" && <FavouriteGrid  favourites={favourites} toggleFav={toggleFav} />}
        {tab === "Complete"  && <CompleteGrid />}
      </main>

      {/* ── RIGHT PANEL ── */}
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
            <p>Unlock all courses &amp; AI features</p>
          </div>
          <button className="btn-upgrade-sm">Upgrade →</button>
        </div>
      </aside>

    </div>
  );
}

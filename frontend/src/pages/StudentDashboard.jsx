import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaBookOpen,
  FaBrain,
  FaBullseye,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaChevronRight,
  FaClock,
  FaComments,
  FaFire,
  FaGraduationCap,
  FaHeart,
  FaHome,
  FaHistory,
  FaPlus,
  FaPlay,
  FaSave,
  FaSearch,
  FaSignOutAlt,
  FaStickyNote,
  FaTimes,
  FaTrash,
  FaTrophy,
} from "react-icons/fa";
import "../styles/StudentDashboard.css";
import MessageBox from "../components/MessageBox";
import DashboardSearch from "../components/DashboardSearch";
import availableCourses from "../data/courses";

const courses = [
  { slug: "mathematics", name: "Mathematics", lesson: "Quadratic Equations", progress: 72, color: "purple" },
  { slug: "science", name: "Science", lesson: "Forces and Motion", progress: 48, color: "blue" },
  { slug: "english", name: "English", lesson: "Creative Writing", progress: 86, color: "pink" },
];

const dailyPlan = [
  { id: "math", title: "Complete Quadratic Equations", detail: "Mathematics · 25 min" },
  { id: "science", title: "Review Forces and Motion", detail: "Science · 20 min" },
  { id: "english", title: "Review creative writing notes", detail: "English · 15 min" },
];

const recentActivity = [
  { title: "Quadratic Equations", detail: "Lesson watched · 18 min ago", icon: FaPlay },
  { title: "Forces and Motion", detail: "Note updated · Yesterday", icon: FaStickyNote },
  { title: "Mathematics help", detail: "AI conversation · 2 days ago", icon: FaBrain },
];

const summarizedNotes = [
  { id: "summary-math-1", course: "Mathematics", title: "Quadratic Equations", body: "A quadratic equation has the form ax² + bx + c = 0. Solve it by factoring, completing the square, or using the quadratic formula. The discriminant, b² − 4ac, shows whether the equation has two, one, or no real solutions." },
  { id: "summary-science-1", course: "Science", title: "Forces and Motion", body: "Force changes an object's motion. Newton's laws connect force, mass, and acceleration, explain balanced and unbalanced forces, and show that every action has an equal and opposite reaction." },
  { id: "summary-english-1", course: "English", title: "Creative Writing", body: "Strong creative writing combines a clear point of view, purposeful structure, vivid sensory details, and believable characters. Revising improves clarity, pacing, word choice, and emotional impact." },
];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function StudentDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [activeSection, setActiveSection] = useState("dashboard");
  const notesStorageKey = `edunova-notes-${user?.id || "student"}`;
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(notesStorageKey)) || [];
    } catch {
      return [];
    }
  });
  const [noteId, setNoteId] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteCourse, setNoteCourse] = useState(courses[0].name);
  const [noteBody, setNoteBody] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notePage, setNotePage] = useState("folders");
  const [noteType, setNoteType] = useState("summaries");
  const [noteFolder, setNoteFolder] = useState("All Notes");
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedSummaryId, setSelectedSummaryId] = useState(summarizedNotes[0].id);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [completedPlan, setCompletedPlan] = useState([]);
  const [goals, setGoals] = useState([
    { id: "lessons", label: "Complete lessons", current: 3, target: 5 },
    { id: "hours", label: "Study hours", current: 4, target: 7 },
  ]);
  const savedCourseSlugs = (() => {
    try { return JSON.parse(localStorage.getItem("edunova-saved-courses")) || []; } catch { return []; }
  })();
  const savedCourseItems = availableCourses.filter((course) => savedCourseSlugs.includes(course.slug));
  const noteFolders = ["All Notes", ...courses.map((course) => course.name)];
  const activeNotes = noteType === "summaries" ? summarizedNotes : notes;
  const visibleNotes = activeNotes.filter((note) => (noteFolder === "All Notes" || note.course === noteFolder) && `${note.course} ${note.title} ${note.body}`.toLowerCase().includes(noteSearch.trim().toLowerCase()));
  const selectedSummary = summarizedNotes.find((note) => note.id === selectedSummaryId) || summarizedNotes[0];
  const selectedManualNote = notes.find((note) => note.id === noteId);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/auth";
  };

  const navItems = [
    { id: "dashboard", label: "My Dashboard", icon: FaHome },
    { id: "courses", label: "My Courses", icon: FaBookOpen },
    { id: "performance", label: "Performance", icon: FaChartLine },
    { id: "calendar", label: "Calendar", icon: FaCalendarAlt },
    { id: "notes", label: "My Notes", icon: FaStickyNote },
    { id: "saved", label: "Saved Courses", icon: FaHeart },
    { id: "achievements", label: "Achievements", icon: FaTrophy },
  ];

  const openSection = (id) => {
    if (id === "courses") {
      navigate("/my-courses");
      return;
    }
    setActiveSection(id);
    if (id === "notes") {
      setNotePage("folders");
      setNotesOpen(true);
      return;
    }
    const sectionIds = {
      dashboard: "student-dashboard-top",
      performance: "student-performance",
      calendar: "student-calendar",
      saved: "student-saved",
      achievements: "student-achievements",
    };
    const sectionId = sectionIds[id];
    if (sectionId) {
      requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  const resetNote = () => {
    setNoteType("manual");
    setNotePage("editor");
    setNoteId(null);
    setNoteTitle("");
    setNoteCourse("Personal");
    setNoteBody("");
  };

  const switchNoteType = (type) => {
    setNoteType(type);
    setNotePage("list");
    setNoteFolder("All Notes");
    setNoteSearch("");
  };

  const saveNotes = (updatedNotes) => {
    setNotes(updatedNotes);
    localStorage.setItem(notesStorageKey, JSON.stringify(updatedNotes));
  };

  const handleSaveNote = (event) => {
    event.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim()) return;

    const savedNote = {
      id: noteId || Date.now(),
      title: noteTitle.trim(),
      course: noteCourse,
      body: noteBody.trim(),
      updatedAt: new Date().toLocaleDateString(),
    };
    const updatedNotes = noteId
      ? notes.map((note) => note.id === noteId ? savedNote : note)
      : [savedNote, ...notes];

    saveNotes(updatedNotes);
    resetNote();
  };

  const editNote = (note) => {
    setNoteId(note.id);
    setNoteTitle(note.title);
    setNoteCourse(note.course);
    setNoteBody(note.body);
    setNotePage("editor");
  };

  const viewManualNote = (note) => {
    setNoteId(note.id);
    setNotePage("detail");
  };


  const viewSummary = (note) => {
    setSelectedSummaryId(note.id);
    setNotePage("detail");
  };

  const deleteNote = (id) => {
    saveNotes(notes.filter((note) => note.id !== id));
    if (noteId === id) {
      setNoteId(null);
      setNotePage("list");
    }
  };

  const togglePlanItem = (id) => {
    setCompletedPlan((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const advanceGoal = (id) => {
    setGoals((current) => current.map((goal) => goal.id === id ? { ...goal, current: Math.min(goal.current + 1, goal.target) } : goal));
  };

  return (
    <main className="student-dashboard">
      <aside className="student-sidebar">
        <Link to="/" className="student-brand">
          <span><FaGraduationCap /></span>
          <strong>EDUNOVA</strong>
        </Link>

        <nav className="student-navigation" aria-label="Student dashboard">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              className={activeSection === id ? "active" : undefined}
              aria-pressed={activeSection === id}
              onClick={() => openSection(id)}
              key={id}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="student-sidebar-help">
          <FaBrain />
          <strong>Need help?</strong>
          <p>Ask the AI assistant whenever you get stuck.</p>
          <Link to="/ai-chatbot">Ask AI</Link>
        </div>

        <button type="button" className="student-logout" onClick={handleLogout}>
          <FaSignOutAlt /> Log out
        </button>
      </aside>

      <div className="student-main" id="student-dashboard-top">
        <header className="student-topbar">
          <div>
            <p>Friday, August 14</p>
            <h1>Welcome back, {user?.name?.split(" ")[0] || "Student"}!</h1>
          </div>
          <DashboardSearch />
          <div className="student-topbar-actions">
            <button type="button" aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => setNotificationOpen((current) => !current)}><FaBell />{!notificationsRead && <span />}</button>
            {notificationOpen && (
              <div className="student-notifications">
                <header><div><strong>Notifications</strong><small>3 new updates</small></div><button type="button" onClick={() => setNotificationsRead(true)}>Mark all read</button></header>
                <article><span><FaComments /></span><div><strong>New instructor message</strong><p>Your Mathematics tutor replied to your question.</p><small>10 min ago</small></div></article>
                <article><span><FaBullseye /></span><div><strong>Weekly goal update</strong><p>You are two lessons away from this week’s goal.</p><small>1 hour ago</small></div></article>
                <article><span><FaBookOpen /></span><div><strong>New lesson available</strong><p>Forces and Motion is ready to continue.</p><small>Yesterday</small></div></article>
              </div>
            )}
            <MessageBox />
            <div className="student-avatar">{user?.name?.[0]?.toUpperCase() || "S"}</div>
          </div>
        </header>

        <section className="student-welcome-card">
          <div>
            <span>KEEP LEARNING</span>
            <h2>You’re making great progress</h2>
            <p>Complete today’s lesson to keep your seven-day learning streak alive.</p>
            <Link to="/courses">Continue learning <FaChevronRight /></Link>
          </div>
          <div className="student-streak"><FaFire /><strong>7</strong><span>day streak</span></div>
        </section>

        <section className="student-stats" aria-label="Learning summary">
          <article><span><FaBookOpen /></span><div><strong>3</strong><p>Active courses</p></div></article>
          <article><span><FaClock /></span><div><strong>18.5h</strong><p>Learning time</p></div></article>
          <article><span><FaCheckCircle /></span><div><strong>24</strong><p>Lessons completed</p></div></article>
          <article><span><FaTrophy /></span><div><strong>1,280</strong><p>Points earned</p></div></article>
        </section>

        <div className="student-priority-grid">
          <section className="student-panel student-daily-plan">
            <header><div><span>TODAY'S FOCUS</span><h2>Personalized daily plan</h2></div><strong>{completedPlan.length}/{dailyPlan.length}</strong></header>
            <div className="student-plan-progress"><span style={{ width: `${(completedPlan.length / dailyPlan.length) * 100}%` }} /></div>
            <div className="student-plan-list">
              {dailyPlan.map((item) => <label className={completedPlan.includes(item.id) ? "completed" : undefined} key={item.id}><input type="checkbox" checked={completedPlan.includes(item.id)} onChange={() => togglePlanItem(item.id)} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></label>)}
            </div>
          </section>
          <section className="student-panel student-goals">
            <header><div><span>THIS WEEK</span><h2>Goals and milestones</h2></div><FaBullseye /></header>
            {goals.map((goal) => <article key={goal.id}><div><strong>{goal.label}</strong><span>{goal.current} of {goal.target}</span></div><div className="student-goal-progress"><span style={{ width: `${(goal.current / goal.target) * 100}%` }} /></div><button type="button" onClick={() => advanceGoal(goal.id)} disabled={goal.current === goal.target}><FaPlus /> Add progress</button></article>)}
          </section>
        </div>

        <div className="student-content-grid">
          <section className="student-panel student-course-panel" id="student-courses">
            <header><div><span>MY COURSES</span><h2>Continue learning</h2></div><Link to="/my-courses">View all</Link></header>
            <div className="student-course-list">
              {courses.map((course) => (
                <article className="student-course-row" key={course.name}>
                  <div className={`student-course-icon ${course.color}`}><FaBookOpen /></div>
                  <div className="student-course-info">
                    <div><h3>{course.name}</h3><span>{course.progress}%</span></div>
                    <p>Next: {course.lesson}</p>
                    <div className="student-progress"><span style={{ width: `${course.progress}%` }} /></div>
                  </div>
                  <Link to={`/courses/${course.slug}`} state={{ from: "/my-courses" }} aria-label={`Continue ${course.name}`}><FaPlay /></Link>
                </article>
              ))}
            </div>
          </section>

          <section className="student-panel student-schedule-panel">
            <header><div><span>UP NEXT</span><h2>Today’s schedule</h2></div><FaCalendarAlt /></header>
            <div className="student-next-class">
              <time>10:30 AM</time>
              <div><strong>Live Mathematics</strong><p>Quadratic equations · 45 min</p></div>
            </div>
            <div className="student-next-class">
              <time>2:00 PM</time>
              <div><strong>Science study group</strong><p>Forces and motion · 60 min</p></div>
            </div>
          </section>

          <section className="student-panel student-performance-panel" id="student-performance">
            <header><div><span>PERFORMANCE</span><h2>Weekly activity</h2></div><FaChartLine /></header>
            <div className="student-chart" aria-label="Weekly study activity">
              {[45, 72, 54, 88, 65, 38, 76].map((height, index) => (
                <div key={index}><span style={{ height: `${height}%` }} /><small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small></div>
              ))}
            </div>
            <p><FaChartLine /> 12% more learning time than last week</p>
          </section>

          <section className="student-panel student-recent-panel">
            <header><div><span>CONTINUE WHERE YOU LEFT OFF</span><h2>Recent activity</h2></div><FaHistory /></header>
            <div className="student-recent-list">{recentActivity.map(({ title, detail, icon: Icon }) => <article key={title}><span><Icon /></span><div><strong>{title}</strong><small>{detail}</small></div></article>)}</div>
          </section>

          <section className="student-panel student-saved-panel" id="student-saved">
            <header><div><span>YOUR COLLECTION</span><h2>Saved courses</h2></div><FaHeart /></header>
            {savedCourseItems.length ? <div className="student-saved-list">{savedCourseItems.slice(0, 3).map((course) => <Link to={`/courses/${course.slug}`} key={course.slug}><span><FaBookOpen /></span><div><strong>{course.name}</strong><small>{course.level} · {course.duration}</small></div></Link>)}</div> : <div className="student-saved-empty"><p>Save courses with the heart icon to find them here.</p><Link to="/courses">Explore courses</Link></div>}
          </section>

          <section className="student-panel student-achievements-panel" id="student-achievements">
            <header><div><span>YOUR PROGRESS</span><h2>Achievements</h2></div><FaTrophy /></header>
            <div className="student-achievement-list">
              <article><span><FaFire /></span><div><strong>7-Day Streak</strong><small>Learned every day this week</small></div></article>
              <article><span><FaBookOpen /></span><div><strong>Lesson Explorer</strong><small>Completed 24 lessons</small></div></article>
              <article className="locked"><span><FaTrophy /></span><div><strong>Course Finisher</strong><small>Complete your first full course</small></div></article>
            </div>
          </section>

          <section className="student-panel student-calendar-panel" id="student-calendar">
            <header><div><span>STUDY PLANNER</span><h2>August 2026</h2></div><FaCalendarAlt /></header>
            <div className="student-calendar-weekdays">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="student-calendar-grid">
              {Array.from({ length: 6 }, (_, index) => <span className="outside" key={`blank-${index}`} />)}
              {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                <button type="button" className={day === 15 ? "today" : undefined} key={day} aria-label={`August ${day}`}>
                  <span>{day}</span>
                  {[17, 21, 24, 28].includes(day) && <i />}
                </button>
              ))}
            </div>
            <div className="student-calendar-legend"><span><i /> Lesson</span></div>
          </section>

          {notesOpen && <div className="student-notes-overlay">
            <section className="student-notepad student-notes-page" role="dialog" aria-modal="true" aria-labelledby="student-notes-title">
              <header className="student-notes-toolbar">
                <div>{notePage !== "folders" && <button type="button" onClick={() => setNotePage(notePage === "list" ? "folders" : "list")} aria-label="Go back"><FaChevronRight /></button>}<strong id="student-notes-title">{notePage === "folders" ? "My Notes" : noteType === "summaries" ? "Summaries" : "Notes"}</strong></div>
                <button type="button" onClick={() => setNotesOpen(false)} aria-label="Close notes"><FaTimes /></button>
              </header>
              <div className="student-notes-workspace">
                {notePage === "folders" && <div className="student-note-home">
                  <div className="student-note-home-heading"><span>YOUR NOTEBOOK</span><h3>What would you like to open?</h3><p>Keep lesson knowledge and personal ideas organized in one place.</p></div>
                  <button type="button" onClick={() => switchNoteType("summaries")}><span><FaBrain /></span><div><strong>Summaries</strong><small>Automatic, read-only lesson summaries</small><i>Course · Lesson · Key ideas</i></div><b>{summarizedNotes.length}</b><FaChevronRight /></button>
                  <button type="button" onClick={() => switchNoteType("manual")}><span><FaStickyNote /></span><div><strong>Notes</strong><small>Your personal notes and ideas</small><i>Create · Edit · Organize</i></div><b>{notes.length}</b><FaChevronRight /></button>
                </div>}

                {notePage === "list" && <div className="student-note-list-page">
                  <div className="student-note-list-tools">
                    <label className="student-note-search"><FaSearch /><input type="search" value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder={noteType === "summaries" ? "Search course or lesson" : "Search notes"} aria-label="Search notes" /></label>
                    {noteType === "manual" && <button type="button" onClick={resetNote}><FaPlus /> New note</button>}
                  </div>
                  {noteType === "summaries" && <div className="student-note-course-filters">{noteFolders.map((folder) => <button type="button" className={noteFolder === folder ? "active" : undefined} onClick={() => setNoteFolder(folder)} key={folder}>{folder}</button>)}</div>}
                  <div className="student-note-browser-heading"><strong>{noteType === "summaries" ? noteFolder : "All Notes"}</strong><small>{visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}</small></div>
                  <div className="student-saved-notes">
                    {visibleNotes.length === 0 ? <div className="student-notes-empty"><FaStickyNote /><p>{noteType === "summaries" ? "Your lesson summaries will appear here." : "Create your first personal note."}</p></div> : visibleNotes.map((note) => (
                      <article key={note.id}><button type="button" onClick={() => noteType === "summaries" ? viewSummary(note) : viewManualNote(note)}><span>{note.course}</span><strong>{note.title}</strong><p>{note.body}</p><small>{noteType === "summaries" ? "Read summary" : `Updated ${note.updatedAt}`}</small></button></article>
                    ))}
                  </div>
                </div>}

                {notePage === "detail" && (noteType === "summaries" ? <article className="student-summary-reader"><span>COURSE SUMMARY</span><small>{selectedSummary.course}</small><h3>{selectedSummary.title}</h3><div className="student-summary-divider" /><p>{selectedSummary.body}</p><footer><FaBrain /> Generated from the completed lesson · Read only</footer></article> : selectedManualNote && <article className="student-summary-reader student-manual-reader"><span>PERSONAL NOTE</span><h3>{selectedManualNote.title}</h3><div className="student-summary-divider" /><p>{selectedManualNote.body}</p><footer><small>Updated {selectedManualNote.updatedAt}</small><div><button type="button" onClick={() => editNote(selectedManualNote)}>Edit note</button><button type="button" onClick={() => deleteNote(selectedManualNote.id)}><FaTrash /> Delete</button></div></footer></article>)}

                {notePage === "editor" && <form className="student-note-editor" onSubmit={handleSaveNote}><label>Note title<input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Give your note a title" required autoFocus /></label><label>Note<textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write your ideas, questions, or lesson notes..." required /></label><button type="submit"><FaSave /> {noteId ? "Update note" : "Save note"}</button></form>}
              </div>
            </section>
          </div>}
        </div>
      </div>
    </main>
  );
}

export default StudentDashboard;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBookOpen,
  FaBrain,
  FaBullseye,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaChevronRight,
  FaClock,
  FaFire,
  FaGraduationCap,
  FaHeart,
  FaHome,
  FaHistory,
  FaIdCard,
  FaPlus,
  FaPlay,
  FaSave,
  FaSearch,
  FaSignOutAlt,
  FaStickyNote,
  FaThLarge,
  FaTimes,
  FaTrash,
  FaTrophy,
} from "react-icons/fa";
import "../styles/StudentDashboard.css";
import MessageBox from "../components/MessageBox";
import DashboardSearch from "../components/DashboardSearch";
import NotificationBell from "../components/NotificationBell";
import { API_ROOT, courseDuration } from "../utils/courseApi";
import { nextIncompleteLessonIndex } from "../utils/lessonProgress";
import { localDateKey, monthDays, shiftMonth, scheduledLessonDates } from "../utils/studyPlanner";
import { logout } from "../utils/authClient";

const dailyPlan = [
  { id: "math", title: "Complete Quadratic Equations", detail: "Mathematics · 25 min" },
  { id: "science", title: "Review Forces and Motion", detail: "Science · 20 min" },
  { id: "english", title: "Review creative writing notes", detail: "English · 15 min" },
];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function normalizePersonalNote(note, database = false) {
  return {
    id: note._id || note.id,
    title: note.title,
    body: note.body,
    course: note.course?.name || note.course || "Personal",
    courseSlug: note.course?.slug || note.courseSlug || "",
    lessonIndex: Number.isInteger(note.lessonIndex) ? note.lessonIndex : null,
    lessonTitle: note.lessonTitle || "",
    lessonId: note.lessonId || "",
    sourceType: note.sourceType || "personal",
    createdAt: note.createdAt || note.updatedAt || new Date().toISOString(),
    updatedAt: note.updatedAt || new Date().toISOString(),
    database,
  };
}

function formatNoteTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "Recently") : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function StudentDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [today, setToday] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [progressReload, setProgressReload] = useState(0);
  const [achievements, setAchievements] = useState(null);
  const [progressError, setProgressError] = useState("");
  const calendar = monthDays(calendarMonth);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "hidden") return; setToday(new Date()); setProgressReload(value => value + 1); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("edunova-learning-updated", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("edunova-learning-updated", refresh); window.clearInterval(timer); };
  }, []);
  const [activeSection, setActiveSection] = useState("dashboard");
  const notesStorageKey = `edunova-notes-${user?.id || "student"}`;
  const [notes, setNotes] = useState(() => {
    try {
      const storedNotes = JSON.parse(localStorage.getItem(notesStorageKey));
      return Array.isArray(storedNotes) ? storedNotes.filter((note) => note.sourceType !== "saved_from_summary").map((note) => normalizePersonalNote(note)) : [];
    } catch {
      return [];
    }
  });
  const [noteId, setNoteId] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notePage, setNotePage] = useState("folders");
  const [noteType, setNoteType] = useState("summaries");
  const [noteFolder, setNoteFolder] = useState("All Notes");
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedSummaryId, setSelectedSummaryId] = useState("");
  const [completedPlan, setCompletedPlan] = useState([]);
  const [continueDestination, setContinueDestination] = useState("/my-courses");
  const [savedCourseItems, setSavedCourseItems] = useState([]);
  const [learningStats, setLearningStats] = useState({ activeCourses: 0, studySeconds: 0, completedLessons: 0, completedCourses: 0, streak: 0, recentActivities: [], courses: [] });
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [weeklyGoalInput, setWeeklyGoalInput] = useState("");
  const [weeklyGoalEditing, setWeeklyGoalEditing] = useState(false);
  const [weeklyGoalLoading, setWeeklyGoalLoading] = useState(true);
  const [weeklyGoalSaving, setWeeklyGoalSaving] = useState(false);
  const [weeklyGoalError, setWeeklyGoalError] = useState("");
  const [weeklyGoalReload, setWeeklyGoalReload] = useState(0);
  const noteFolders = ["All Notes", ...new Set([...learningStats.courses.map((course) => course.name), ...notes.map((note) => note.course)].filter(Boolean))];
  const lessonNotes = notes.filter((note) => note.sourceType === "saved_from_summary");
  const personalNotes = notes.filter((note) => note.sourceType !== "saved_from_summary");
  const activeNotes = noteType === "summaries" ? lessonNotes : personalNotes;
  const visibleNotes = activeNotes.filter((note) => (noteFolder === "All Notes" || note.course === noteFolder) && `${note.course} ${note.lessonTitle} ${note.title} ${note.body}`.toLowerCase().includes(noteSearch.trim().toLowerCase()));
  const selectedSummary = activeNotes.find((note) => note.id === selectedSummaryId) || activeNotes[0] || null;
  const selectedManualNote = notes.find((note) => note.id === noteId);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("token");
    if (!token) return () => controller.abort();
    fetch(`${API_ROOT}/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load saved courses");
        return data.favorites || [];
      })
      .then(setSavedCourseItems)
      .catch((error) => { if (error.name !== "AbortError") setSavedCourseItems([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const getNextLessonLink = (course, completedLessons = [], currentLessonIndex) => {
      const slug = course?.slug;
      const lessonCount = course?.lessons?.length || 0;
      if (!slug) return "/my-courses";
      if (!lessonCount) return `/courses/${slug}`;
      const nextIndex = nextIncompleteLessonIndex(lessonCount, completedLessons, currentLessonIndex);
      return `/courses/${slug}/learn/${nextIndex + 1}`;
    };
    const loadContinueDestination = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const response = await fetch(`${API_ROOT}/enrollments/me`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (response.ok) {
            const enrollments = await response.json();
            const activeEnrollment = enrollments.find((item) => item.course?.slug);
            if (activeEnrollment) {
              setContinueDestination(getNextLessonLink(activeEnrollment.course, activeEnrollment.completedLessons || [], activeEnrollment.currentLessonIndex));
              return;
            }
          }
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      setContinueDestination("/my-courses");
    };
    loadContinueDestination();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const buildStats = (enrollments) => {
      const studyDates = new Set(enrollments.flatMap((item) => item.studyDates || []));
      const cursor = new Date();
      const today = cursor.toLocaleDateString("en-CA");
      if (!studyDates.has(today)) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (studyDates.has(cursor.toLocaleDateString("en-CA"))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      const courseProgress = enrollments.map((item, index) => {
        const catalogCourse = item.course || {};
        const lessonCount = catalogCourse.lessons?.length || 0;
        const completedCount = item.completedLessons?.length || 0;
        const progress = lessonCount ? Math.min(Math.round(completedCount / lessonCount * 100), 100) : 0;
        const currentLessonIndex = nextIncompleteLessonIndex(lessonCount, item.completedLessons, item.currentLessonIndex);
        return { slug: catalogCourse.slug, name: catalogCourse.name, lesson: catalogCourse.lessons?.[currentLessonIndex]?.title || "Lessons coming soon", lessonCount, completedCount, progress, currentLessonIndex, color: ["purple", "blue", "pink"][index % 3] };
      });
      const recentActivities = enrollments.flatMap((item) => (item.recentActivity || []).map((activity) => ({ ...activity, courseName: item.course?.name || "Course" }))).sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)).slice(0, 5);
      setLearningStats({
        activeCourses: courseProgress.filter((item) => !item.lessonCount || item.completedCount < item.lessonCount).length,
        studySeconds: enrollments.reduce((total, item) => total + (item.studySeconds || 0), 0),
        completedLessons: courseProgress.reduce((total, item) => total + item.completedCount, 0),
        completedCourses: courseProgress.filter((item) => item.lessonCount > 0 && item.completedCount >= item.lessonCount).length,
        streak,
        recentActivities,
        courses: courseProgress,
      });
    };
    const loadStats = async () => {
      const token = localStorage.getItem("token");
      try {
        if (!token) throw new Error("No account session");
        const response = await fetch(`${API_ROOT}/enrollments/me`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load progress");
        buildStats(await response.json());
        setProgressError("");
      } catch (error) {
        if (error.name === "AbortError") return;
        setProgressError("Unable to refresh learning progress. Please try again.");
      }
    };
    loadStats();
    return () => controller.abort();
  }, [progressReload, activeSection]);

  useEffect(() => {
    const controller = new AbortController();
    const loadWeeklyGoal = async () => {
      setWeeklyGoalLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Please sign in to view your weekly goal.");
        const response = await fetch(`${API_ROOT}/weekly-goal/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load your weekly goal.");
        const goal = await response.json();
        setWeeklyGoal(goal);
        setAchievements(goal.achievements);
        if (!weeklyGoalEditing) setWeeklyGoalInput(goal.weeklyGoalMinutes ? String(goal.weeklyGoalMinutes) : "");
        setWeeklyGoalError("");
      } catch (error) {
        if (error.name !== "AbortError") setWeeklyGoalError(error.message);
      } finally {
        if (!controller.signal.aborted) setWeeklyGoalLoading(false);
      }
    };
    loadWeeklyGoal();
    return () => controller.abort();
  }, [weeklyGoalReload, activeSection, progressReload, weeklyGoalEditing]);

  useEffect(() => {
    const controller = new AbortController();
    const loadNotes = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const response = await fetch(`${API_ROOT}/notes`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load notes");
        const databaseNotes = (await response.json()).map((note) => normalizePersonalNote(note, true));
        const storedNotes = JSON.parse(localStorage.getItem(notesStorageKey));
        const localNotes = Array.isArray(storedNotes) ? storedNotes.filter((note) => note.sourceType !== "saved_from_summary").map((note) => normalizePersonalNote(note)) : [];
        setNotes([...databaseNotes, ...localNotes]);
        setNoteStatus("");
      } catch (error) {
        if (error.name !== "AbortError") setNoteStatus("Notes are currently saved on this device.");
      }
    };
    loadNotes();
    return () => controller.abort();
  }, [notesStorageKey, notesOpen, progressReload]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/auth";
  };

  const navItems = [
    { id: "home", label: "Home", icon: FaHome },
    { id: "dashboard", label: "My Dashboard", icon: FaThLarge },
    { id: "courses", label: "My Courses", icon: FaBookOpen },
    { id: "performance", label: "Performance", icon: FaChartLine },
    { id: "calendar", label: "Calendar", icon: FaCalendarAlt },
    { id: "notes", label: "My Notes", icon: FaStickyNote },
    { id: "tutor-applications", label: "Tutor Applications", icon: FaIdCard },
    { id: "saved", label: "Saved Courses", icon: FaHeart },
    { id: "achievements", label: "Achievements", icon: FaTrophy },
  ];

  const openSection = (id) => {
    if (id === "home") {
      navigate("/home");
      return;
    }
    if (id === "courses") {
      navigate("/my-courses");
      return;
    }
    if (id === "tutor-applications") {
      navigate("/my-tutor-applications");
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
    setNoteBody("");
    setNoteStatus("");
  };

  const switchNoteType = (type) => {
    setNoteType(type);
    setNotePage("list");
    setNoteFolder("All Notes");
    setNoteSearch("");
  };

  const saveNotes = (updatedNotes) => {
    setNotes(updatedNotes);
    localStorage.setItem(notesStorageKey, JSON.stringify(updatedNotes.filter((note) => !note.database)));
  };

  const handleSaveNote = async (event) => {
    event.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim()) return;
    const existingNote = notes.find((note) => note.id === noteId);
    const payload = { title: noteTitle.trim(), body: noteBody.trim(), courseSlug: null, lessonIndex: null, lessonTitle: "" };
    const token = localStorage.getItem("token");
    setNoteStatus("Saving note...");
    try {
      if (!token) throw new Error("Backend unavailable");
      const response = await fetch(existingNote?.database ? `${API_ROOT}/notes/${noteId}` : `${API_ROOT}/notes`, {
        method: existingNote?.database ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save note");
      const savedNote = normalizePersonalNote(data, true);
      saveNotes(existingNote ? notes.map((note) => note.id === noteId ? savedNote : note) : [savedNote, ...notes]);
      setNoteId(savedNote.id);
      setNotePage("detail");
      setNoteStatus("Saved to your account");
    } catch (error) {
      const now = new Date().toISOString();
      const savedNote = normalizePersonalNote({ id: existingNote?.id || `local-${now}`, title: payload.title, body: payload.body, course: "Personal", courseSlug: "", lessonIndex: null, lessonTitle: "", createdAt: existingNote?.createdAt || now, updatedAt: now });
      saveNotes(existingNote ? notes.map((note) => note.id === noteId ? savedNote : note) : [savedNote, ...notes]);
      setNoteId(savedNote.id);
      setNotePage("detail");
      setNoteStatus(error.message === "Backend unavailable" ? "Saved on this device" : `${error.message}. Saved on this device.`);
    }
  };

  const editNote = (note) => {
    setNoteId(note.id);
    setNoteTitle(note.title);
    setNoteBody(note.body);
    setNoteStatus("");
    setNotePage("editor");
  };

  const viewManualNote = (note) => {
    setNoteId(note.id);
    setNotePage("detail");
  };

  const cancelNoteEditor = () => {
    setNoteStatus("");
    setNotePage(noteId ? "detail" : "list");
  };


  const viewSummary = (note) => {
    setSelectedSummaryId(note.id);
    setNotePage("detail");
  };

  const deleteNote = async (id) => {
    const note = notes.find((item) => item.id === id);
    if (note?.database) {
      try {
        const response = await fetch(`${API_ROOT}/notes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
        if (!response.ok) throw new Error("Unable to delete note");
      } catch (error) {
        setNoteStatus(error.message);
        return;
      }
    }
    saveNotes(notes.filter((item) => item.id !== id));
    if (noteId === id) {
      setNoteId(null);
      setNotePage("list");
    }
    setNoteStatus("Note deleted");
  };

  const togglePlanItem = (id) => {
    setCompletedPlan((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const saveWeeklyGoal = async (event) => {
    event.preventDefault();
    const value = weeklyGoalInput.trim();
    const minutes = Number(value);
    if (!/^\d+$/.test(value) || !Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
      setWeeklyGoalError("Enter a whole number between 1 and 10080 minutes.");
      return;
    }
    setWeeklyGoalSaving(true);
    setWeeklyGoalError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please sign in to save your weekly goal.");
      const response = await fetch(`${API_ROOT}/weekly-goal/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weeklyGoalMinutes: minutes }),
      });
      const goal = await response.json();
      if (!response.ok) throw new Error(goal.message || "Unable to save your weekly goal.");
      setWeeklyGoal(goal);
      setWeeklyGoalEditing(false);
    } catch (error) {
      setWeeklyGoalError(error.message);
    } finally {
      setWeeklyGoalSaving(false);
    }
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
          <p>Ask the General AI Tutor for general explanations and study help.</p>
          <Link to="/ai-tutor">General AI Tutor</Link>
        </div>

        <button type="button" className="student-logout" onClick={handleLogout}>
          <FaSignOutAlt /> Log out
        </button>
      </aside>

      <div className="student-main" id="student-dashboard-top">
        <header className="student-topbar">
          <div>
            <p>{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
            <h1>Welcome back, {user?.name?.split(" ")[0] || "Student"}!</h1>
          </div>
          <DashboardSearch />
          <div className="student-topbar-actions">
            <MessageBox />
            <NotificationBell />
          </div>
        </header>

        <section className="student-welcome-card">
          <div>
            <span>KEEP LEARNING</span>
            <h2>You’re making great progress</h2>
            <p>Continue learning today to build your learning streak.</p>
            <Link to={continueDestination} state={{ from: "/student-dashboard" }}>Continue learning <FaChevronRight /></Link>
          </div>
          <div className="student-streak"><FaFire /><strong>{learningStats.streak}</strong><span>day streak</span></div>
        </section>

        <section className="student-stats" aria-label="Learning summary">
          <article><span><FaBookOpen /></span><div><strong>{learningStats.activeCourses}</strong><p>Active courses</p></div></article>
          <article><span><FaClock /></span><div><strong>{learningStats.studySeconds >= 3600 ? `${(learningStats.studySeconds / 3600).toFixed(1)}h` : `${Math.floor(learningStats.studySeconds / 60)}m`}</strong><p>Learning time</p></div></article>
          <article><span><FaCheckCircle /></span><div><strong>{learningStats.completedLessons}</strong><p>Lessons completed</p></div></article>
          <article><span><FaTrophy /></span><div><strong>{learningStats.completedCourses}</strong><p>Courses completed</p></div></article>
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
            <header><div><span>THIS WEEK</span><h2>Weekly learning goal</h2></div><FaBullseye /></header>
            {weeklyGoalLoading ? <p>Loading your weekly goal…</p> : <>
              {weeklyGoal?.weeklyGoalMinutes ? <article className="student-weekly-goal">
                <div><strong>Weekly learning goal</strong><span>{weeklyGoal.learningMinutes} / {weeklyGoal.weeklyGoalMinutes} min</span></div>
                <div className="student-goal-progress" role="progressbar" aria-label="Weekly learning goal progress" aria-valuenow={weeklyGoal.completionPercentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${weeklyGoal.completionPercentage}%` }} /></div>
                <p>{weeklyGoal.completionPercentage}% completed · {weeklyGoal.remainingMinutes} min remaining</p>
                <p>Status: {weeklyGoal.goalStatus === "completed" ? "Goal reached" : "In progress"}</p>
                <button type="button" onClick={() => setWeeklyGoalEditing(true)}>Change goal</button>
              </article> : <p>How many minutes would you like to study each week?</p>}
              {(!weeklyGoal?.weeklyGoalMinutes || weeklyGoalEditing) && <form className="student-weekly-goal-form" onSubmit={saveWeeklyGoal}>
                <label htmlFor="weekly-goal-minutes">Weekly goal (minutes)</label>
                <input id="weekly-goal-minutes" type="number" min="1" max="10080" step="1" value={weeklyGoalInput} onChange={(event) => setWeeklyGoalInput(event.target.value)} required />
                <div><button type="submit" disabled={weeklyGoalSaving}>{weeklyGoalSaving ? "Saving…" : "Save goal"}</button>{weeklyGoal?.weeklyGoalMinutes && <button type="button" onClick={() => { setWeeklyGoalEditing(false); setWeeklyGoalInput(String(weeklyGoal.weeklyGoalMinutes)); setWeeklyGoalError(""); }}>Cancel</button>}</div>
              </form>}
              <small>Study time counts while a course lesson is playing in a visible tab. The week starts Monday (UTC).</small>
            </>}
            {weeklyGoalError && <p role="alert">{weeklyGoalError} <button type="button" onClick={() => setWeeklyGoalReload((value) => value + 1)}>Retry</button></p>}
          </section>
        </div>

        <div className="student-content-grid">
          <section className="student-panel student-course-panel" id="student-courses">
            <header><div><span>MY COURSES</span><h2>Continue learning</h2></div><Link to="/my-courses">View all</Link></header>
            <div className="student-course-list">
              {learningStats.courses.length ? learningStats.courses.map((course) => (
                <article className="student-course-row" key={course.name}>
                  <div className={`student-course-icon ${course.color}`}><FaBookOpen /></div>
                  <div className="student-course-info">
                    <div><h3>{course.name}</h3><span>{course.progress}%</span></div>
                    <p>Next: {course.lesson}</p>
                    <div className="student-progress"><span style={{ width: `${course.progress}%` }} /></div>
                  </div>
                  <Link to={course.lessonCount ? `/courses/${course.slug}/learn/${course.currentLessonIndex + 1}` : `/courses/${course.slug}`} aria-label={`Continue ${course.name}`}><FaPlay /></Link>
                </article>
              )) : <div className="student-saved-empty"><p>Enroll in a course to start tracking your progress.</p><Link to="/courses">Explore courses</Link></div>}
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
            <div className="student-recent-list">{learningStats.recentActivities.length ? learningStats.recentActivities.map((activity, index) => <article key={`${activity.createdAt}-${index}`}><span>{activity.activityType === "lesson_completed" ? <FaCheckCircle /> : <FaPlay />}</span><div><strong>{activity.lessonTitle}</strong><small>{activity.activityType === "lesson_completed" ? "Lesson completed" : "Lesson opened"} · {activity.courseName}</small></div></article>) : <article><span><FaHistory /></span><div><strong>No learning activity yet</strong><small>Open a lesson to begin tracking progress.</small></div></article>}</div>
          </section>

          <section className="student-panel student-saved-panel" id="student-saved">
            <header><div><span>YOUR COLLECTION</span><h2>Saved courses</h2></div><FaHeart /></header>
            {savedCourseItems.length ? <div className="student-saved-list">{savedCourseItems.slice(0, 3).map((course) => <Link to={`/courses/${course.slug}`} key={course.slug}><span><FaBookOpen /></span><div><strong>{course.name}</strong><small>{course.level} · {courseDuration(course)}</small></div></Link>)}</div> : <div className="student-saved-empty"><p>Save courses with the heart icon to find them here.</p><Link to="/courses">Explore courses</Link></div>}
          </section>

          <section className="student-panel student-achievements-panel" id="student-achievements">
            <header><div><span>YOUR PROGRESS</span><h2>Achievements</h2></div><FaTrophy /></header>
            <div className="student-achievement-list">
              {achievements?.map(achievement => <article className={achievement.earned ? "earned" : "locked"} key={achievement.id}><span>{achievement.id === "streak" ? <FaFire /> : achievement.id === "lessons" ? <FaBookOpen /> : <FaTrophy />}</span><div><strong>{achievement.title}</strong><small>{achievement.detail}</small><small>{achievement.earned ? "Earned" : "Locked"}</small></div></article>)}
              {!achievements && <p>{weeklyGoalError || "Loading achievements…"}</p>}
              {progressError && <p role="alert">{progressError}<button type="button" onClick={() => setProgressReload(value => value + 1)}>Retry</button></p>}
            </div>
          </section>

          <section className="student-panel student-calendar-panel" id="student-calendar">
            <header><div><span>STUDY PLANNER</span><h2>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div><FaCalendarAlt /></header>
            <nav className="student-calendar-navigation" aria-label="Calendar navigation"><button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(month => shiftMonth(month, -1))}>‹</button><button type="button" onClick={() => { const now = new Date(); setToday(now); setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(localDateKey(now)); }}>Today</button><button type="button" aria-label="Next month" onClick={() => setCalendarMonth(month => shiftMonth(month, 1))}>›</button></nav>
            <div className="student-calendar-weekdays">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="student-calendar-grid">
              {Array.from({ length: calendar.offset }, (_, index) => <span className="outside" key={`blank-${index}`} />)}
              {calendar.days.map(date => { const key = localDateKey(date), isToday = key === localDateKey(today), scheduled = scheduledLessonDates.has(key); return <button type="button" className={[isToday ? "today" : "", key === selectedDate ? "selected" : ""].filter(Boolean).join(" ")} key={key} aria-current={isToday ? "date" : undefined} aria-pressed={key === selectedDate} aria-label={`${date.toLocaleDateString(undefined, { dateStyle: "full" })}${scheduled ? ", Lesson scheduled" : ""}`} onClick={() => setSelectedDate(key)}><span>{date.getDate()}</span>{scheduled && <i />}</button>; })}
            </div>
            <div className="student-calendar-legend"><span><i /> Lesson</span><span>Outline: today · Filled: selected</span></div>
          </section>

          {notesOpen && <div className="student-notes-overlay">
            <section className="student-notepad student-notes-page" role="dialog" aria-modal="true" aria-labelledby="student-notes-title">
              <header className="student-notes-toolbar">
                <div>{notePage !== "folders" && <button type="button" onClick={() => setNotePage(notePage === "list" ? "folders" : "list")} aria-label="Go back"><FaChevronRight /></button>}<strong id="student-notes-title">{notePage === "folders" ? "My Notes" : noteType === "summaries" ? "Lesson Notes" : "Personal Notes"}</strong></div>
                {noteStatus && <small className="student-note-status">{noteStatus}</small>}
                <button type="button" onClick={() => setNotesOpen(false)} aria-label="Close notes"><FaTimes /></button>
              </header>
              <div className="student-notes-workspace">
                {notePage === "folders" && <div className="student-note-home">
                  <div className="student-note-home-heading"><span>YOUR NOTEBOOK</span><h3>What would you like to open?</h3><p>Keep lesson knowledge and personal ideas organized in one place.</p></div>
                  <button type="button" onClick={() => switchNoteType("summaries")}><span><FaBrain /></span><div><strong>Lesson Notes</strong><small>Summaries you explicitly saved from lessons</small><i>Course · Lesson · Key ideas</i></div><b>{lessonNotes.length}</b><FaChevronRight /></button>
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
                    {visibleNotes.length === 0 ? <div className="student-notes-empty"><FaStickyNote /><p>{noteType === "summaries" ? "Open a lesson, choose Summary, then select “Save to Lesson Notes”. Your saved summary will appear here with its course and lesson title." : "Create your first personal note."}</p></div> : visibleNotes.map((note) => (
                      <article key={note.id}><button type="button" onClick={() => noteType === "summaries" ? viewSummary(note) : viewManualNote(note)}><span>{note.course}{note.lessonTitle ? ` · ${note.lessonTitle}` : ""}</span><strong>{note.title}</strong><p>{note.body}</p><small>{noteType === "summaries" ? "Read summary" : `Updated ${formatNoteTimestamp(note.updatedAt)}`}</small></button></article>
                    ))}
                  </div>
                </div>}

                {notePage === "detail" && (noteType === "summaries" ? selectedSummary&&<article className="student-summary-reader"><span>LESSON NOTE</span><small>{selectedSummary.course}{selectedSummary.lessonTitle ? ` · ${selectedSummary.lessonTitle}` : ""}</small><h3>{selectedSummary.title}</h3><div className="student-summary-divider" /><p>{selectedSummary.body}</p><footer>{selectedSummary.courseSlug&&Number.isInteger(selectedSummary.lessonIndex)&&<button type="button" onClick={()=>navigate(`/courses/${selectedSummary.courseSlug}/learn/${selectedSummary.lessonIndex+1}`)}>Return to Lesson</button>}</footer></article> : selectedManualNote && <article className="student-summary-reader student-manual-reader"><span>PERSONAL NOTE</span><small>{selectedManualNote.course}{selectedManualNote.lessonTitle ? ` · ${selectedManualNote.lessonTitle}` : ""}</small><h3>{selectedManualNote.title}</h3><div className="student-summary-divider" /><p>{selectedManualNote.body}</p><footer><small>Created {formatNoteTimestamp(selectedManualNote.createdAt)} · Updated {formatNoteTimestamp(selectedManualNote.updatedAt)}</small><div><button type="button" onClick={() => editNote(selectedManualNote)}>Edit note</button><button type="button" onClick={() => deleteNote(selectedManualNote.id)}><FaTrash /> Delete</button></div></footer></article>)}

                {notePage === "editor" && <form className="student-note-editor" onSubmit={handleSaveNote}><label>Note title<input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Give your note a title" required autoFocus /></label><label>Note<textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write your ideas, questions, or lesson notes..." required /></label><div className="student-note-editor-actions"><button type="button" onClick={cancelNoteEditor}>Cancel</button><button type="submit"><FaSave /> {noteId ? "Update note" : "Save note"}</button></div></form>}
              </div>
            </section>
          </div>}
        </div>
      </div>
    </main>
  );
}

export default StudentDashboard;

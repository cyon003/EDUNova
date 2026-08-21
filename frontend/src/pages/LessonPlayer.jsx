import { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaBookOpen, FaCheck, FaChevronLeft, FaChevronRight, FaClock, FaGraduationCap, FaPlay } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../styles/LessonPlayer.css";

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function LessonPlayer() {
  const { courseSlug, lessonNumber } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const lastLocalSave = useRef(0);
  const playStartedAt = useRef(null);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const lessons = course?.lessons || [];
  const savedLessonIndex = Number.parseInt(localStorage.getItem(`edunova-current-lesson-${courseSlug}`) || "0", 10);
  const requestedIndex = Math.max(Number.parseInt(lessonNumber || String((Number.isNaN(savedLessonIndex) ? 0 : savedLessonIndex) + 1), 10) - 1, 0);
  const lessonIndex = Math.min(Number.isNaN(requestedIndex) ? 0 : requestedIndex, Math.max(lessons.length - 1, 0));
  const lesson = lessons[lessonIndex];
  const progressKey = `edunova-lesson-progress-${courseSlug}`;
  const positionsKey = `edunova-video-positions-${courseSlug}`;
  const currentLessonKey = `edunova-current-lesson-${courseSlug}`;
  const [completedLessons, setCompletedLessons] = useState(() => readArray(progressKey));
  const [videoPositions, setVideoPositions] = useState(() => readObject(positionsKey));
  const [syncMessage, setSyncMessage] = useState("");

  const syncProgress = async ({ completed = completedLessons, index = lessonIndex, seconds, studiedSeconds = 0, activity } = {}) => {
    if (studiedSeconds > 0) {
      const studySecondsKey = `edunova-study-seconds-${courseSlug}`;
      const previousSeconds = Number.parseInt(localStorage.getItem(studySecondsKey) || "0", 10);
      localStorage.setItem(studySecondsKey, String((Number.isNaN(previousSeconds) ? 0 : previousSeconds) + studiedSeconds));
      const studyDatesKey = `edunova-study-dates-${courseSlug}`;
      const dates = readArray(studyDatesKey);
      const today = new Date().toLocaleDateString("en-CA");
      localStorage.setItem(studyDatesKey, JSON.stringify(dates.includes(today) ? dates : [...dates, today]));
    }
    if (activity) {
      const activityKey = `edunova-recent-activity-${courseSlug}`;
      const activities = readArray(activityKey);
      localStorage.setItem(activityKey, JSON.stringify([{ ...activity, createdAt: new Date().toISOString() }, ...activities].slice(0, 50)));
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const body = { completedLessons: completed, currentLessonIndex: index };
      if (Number.isFinite(seconds)) body.videoPosition = { lessonIndex: index, seconds: Math.max(0, Math.round(seconds)) };
      if (studiedSeconds > 0) {
        body.studiedSeconds = studiedSeconds;
        body.studyDate = new Date().toLocaleDateString("en-CA");
      }
      if (activity) body.activity = activity;
      const response = await fetch(`http://localhost:5050/api/enrollments/${courseSlug}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Progress is saved on this device only");
      setSyncMessage("Progress saved");
    } catch {
      setSyncMessage("Saved on this device");
    }
  };

  const saveVideoPosition = (seconds = videoRef.current?.currentTime || 0, sync = false) => {
    const updated = { ...videoPositions, [lessonIndex]: Math.max(0, Math.round(seconds)) };
    setVideoPositions(updated);
    localStorage.setItem(positionsKey, JSON.stringify(updated));
    localStorage.setItem(currentLessonKey, String(lessonIndex));
    if (sync) syncProgress({ index: lessonIndex, seconds });
  };

  useEffect(() => {
    localStorage.setItem(currentLessonKey, String(lessonIndex));
  }, [currentLessonKey, lessonIndex]);

  useEffect(() => {
    const controller = new AbortController();
    const loadEnrollment = async () => {
      const token = localStorage.getItem("token");
      if (!token) { setCourseLoading(false); return; }
      try {
        const response = await fetch("http://localhost:5050/api/enrollments/me", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) return;
        const enrollments = await response.json();
        const enrollment = enrollments.find((item) => item.course?.slug === courseSlug);
        if (!enrollment) return;
        setCourse(enrollment.course);
        setCompletedLessons(enrollment.completedLessons || []);
        const positions = enrollment.videoPositions || {};
        setVideoPositions((current) => ({ ...current, ...positions }));
        localStorage.setItem(progressKey, JSON.stringify(enrollment.completedLessons || []));
        localStorage.setItem(positionsKey, JSON.stringify({ ...readObject(positionsKey), ...positions }));
      } catch (error) {
        if (error.name !== "AbortError") setSyncMessage("Using saved progress from this device");
      } finally { if (!controller.signal.aborted) setCourseLoading(false); }
    };
    loadEnrollment();
    return () => controller.abort();
  }, [courseSlug, positionsKey, progressKey]);

  const toggleComplete = () => {
    const completing = !completedLessons.includes(lessonIndex);
    const updated = completing ? [...completedLessons, lessonIndex] : completedLessons.filter((item) => item !== lessonIndex);
    setCompletedLessons(updated);
    localStorage.setItem(progressKey, JSON.stringify(updated));
    syncProgress({ completed: updated, index: lessonIndex, seconds: videoRef.current?.currentTime, activity: completing ? { activityType: "lesson_completed", lessonIndex, lessonTitle: lesson.title } : undefined });
  };

  const openLesson = (index) => {
    const studiedSeconds = playStartedAt.current ? Math.max(Math.round((Date.now() - playStartedAt.current) / 1000), 1) : 0;
    playStartedAt.current = null;
    saveVideoPosition(videoRef.current?.currentTime);
    syncProgress({ index: lessonIndex, seconds: videoRef.current?.currentTime, studiedSeconds });
    navigate(`/courses/${courseSlug}/learn/${index + 1}`);
  };

  if (courseLoading) return <main className="lesson-player-state"><h1>Loading lesson...</h1></main>;
  if (!course) return <main className="lesson-player-state"><h1>Course unavailable</h1><p>You can only open lessons from a course enrolled in your account.</p><Link to="/my-courses">Return to My Courses</Link></main>;
  if (!lesson) return <main className="lesson-player-state"><FaBookOpen /><h1>No lessons available yet</h1><p>This course does not have lesson videos.</p><Link to={`/courses/${courseSlug}`}>View course details</Link></main>;

  const progress = Math.round(completedLessons.length / lessons.length * 100);

  return <main className="lesson-player-page">
    <header className="lesson-player-topbar">
      <Link to="/" className="lesson-player-brand"><span><FaGraduationCap /></span><strong>EDUNOVA</strong></Link>
      <div><span>{course.name}</span><strong>{progress}% complete</strong><i><b style={{ width: `${progress}%` }} /></i></div>
      <Link to="/my-courses"><FaArrowLeft /> My Courses</Link>
    </header>

    <div className="lesson-player-layout">
      <aside className="lesson-curriculum">
        <header><small>COURSE CURRICULUM</small><h2>{course.name}</h2><p>{completedLessons.length} of {lessons.length} lessons completed</p></header>
        <nav aria-label="Course lessons">
          {lessons.map((item, index) => <button type="button" className={`${index === lessonIndex ? "active" : ""} ${completedLessons.includes(index) ? "completed" : ""}`} onClick={() => openLesson(index)} key={item.title}>
            <span>{completedLessons.includes(index) ? <FaCheck /> : String(index + 1).padStart(2, "0")}</span>
            <div><strong>{item.title}</strong><small><FaClock /> {item.duration}</small></div>
            {index === lessonIndex && <FaPlay />}
          </button>)}
        </nav>
      </aside>

      <section className="lesson-workspace">
        <div className="lesson-video-shell">
          <video
            ref={videoRef}
            controls
            key={`${courseSlug}-${lessonIndex}`}
            onLoadedMetadata={(event) => { const savedPosition = Number(videoPositions[lessonIndex]) || 0; if (savedPosition < event.currentTarget.duration - 1) event.currentTarget.currentTime = savedPosition; syncProgress({ index: lessonIndex, activity: { activityType: "lesson_opened", lessonIndex, lessonTitle: lesson.title } }); }}
            onPlay={() => { if (!playStartedAt.current) playStartedAt.current = Date.now(); }}
            onTimeUpdate={(event) => { if (event.currentTarget.currentTime - lastLocalSave.current >= 3) { lastLocalSave.current = event.currentTarget.currentTime; saveVideoPosition(event.currentTarget.currentTime); } }}
            onPause={(event) => { const studiedSeconds = playStartedAt.current ? Math.max(Math.round((Date.now() - playStartedAt.current) / 1000), 1) : 0; playStartedAt.current = null; saveVideoPosition(event.currentTarget.currentTime); syncProgress({ index: lessonIndex, seconds: event.currentTarget.currentTime, studiedSeconds }); }}
            onEnded={() => {
              const studiedSeconds = playStartedAt.current ? Math.max(Math.round((Date.now() - playStartedAt.current) / 1000), 1) : 0;
              playStartedAt.current = null;
              const updatedLessons = completedLessons.includes(lessonIndex) ? completedLessons : [...completedLessons, lessonIndex];
              setCompletedLessons(updatedLessons);
              localStorage.setItem(progressKey, JSON.stringify(updatedLessons));
              saveVideoPosition(0);
              syncProgress({ completed: updatedLessons, index: lessonIndex, seconds: 0, studiedSeconds, activity: { activityType: "lesson_completed", lessonIndex, lessonTitle: lesson.title } });
            }}
          >
            <source src={lesson.videoUrl} type="video/mp4" />
            Your browser does not support HTML video.
          </video>
        </div>

        <article className="lesson-player-content">
          <div className="lesson-player-heading"><div><small>LESSON {lessonIndex + 1} OF {lessons.length}</small><h1>{lesson.title}</h1><p>{lesson.description}</p></div><button type="button" className={completedLessons.includes(lessonIndex) ? "completed" : ""} onClick={toggleComplete}><FaCheck /> {completedLessons.includes(lessonIndex) ? "Completed" : "Mark complete"}</button></div>
          <div className="lesson-player-status"><span>{syncMessage || "Your position is saved automatically"}</span><span><FaClock /> {lesson.duration}</span></div>
          <footer>
            <button type="button" onClick={() => openLesson(lessonIndex - 1)} disabled={lessonIndex === 0}><FaChevronLeft /> Previous lesson</button>
            <Link to={`/courses/${courseSlug}`}>Course overview</Link>
            <button type="button" onClick={() => openLesson(lessonIndex + 1)} disabled={lessonIndex === lessons.length - 1}>Next lesson <FaChevronRight /></button>
          </footer>
        </article>
      </section>
    </div>
  </main>;
}

export default LessonPlayer;

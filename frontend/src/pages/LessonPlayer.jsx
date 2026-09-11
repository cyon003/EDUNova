import { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaBookOpen, FaCheck, FaChevronLeft, FaChevronRight, FaClock, FaGraduationCap, FaPlay, FaSave, FaTrash } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";
import { canPreviewResource, fileType, formatFileSize, getLessonPrimaryMedia, lessonReferences, supportingResources, supportsLessonTranscript } from "../utils/lessonMedia";
import { API_ROOT, getPublicCourse } from "../utils/courseApi";
import { LessonSummaryPanel, VideoTranscriptPanel } from "../components/Summaries";
import { useAuth } from "../hooks/useAuth";
import { useLearningSignal } from "../hooks/useLearningSignal";
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

function LessonNotes({ courseSlug, lessonIndex, lesson, user }) {
  const [notes, setNotes] = useState([]); const [title, setTitle] = useState(`${lesson.title} notes`); const [body, setBody] = useState(""); const [editingId, setEditingId] = useState(""); const [status, setStatus] = useState(""); const token = localStorage.getItem("token");
  useEffect(() => {
    if (!token || user?.role !== "student") return undefined;
    const controller = new AbortController();
    fetch(`${API_ROOT}/notes`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load notes")))
      .then((items) => setNotes(items.filter((item) => item.course?.slug === courseSlug && item.lessonIndex === lessonIndex)))
      .catch((error) => {
        if (error.name !== "AbortError") setStatus(error.message);
      });
    return () => controller.abort();
  }, [courseSlug, lessonIndex, token, user?.role]);
  if (!token || user?.role !== "student") return <div className="lesson-tool-placeholder"><h3>Personal Notes</h3><p>Sign in as a student to save notes for this lesson.</p></div>;
  const saveNote = async (event) => { event.preventDefault(); setStatus(""); const response = await fetch(`${API_ROOT}/notes${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title, body, courseSlug, lessonIndex, lessonTitle: lesson.title }) }); const data = await response.json(); if (!response.ok) { setStatus(data.message || "Unable to save note"); return; } setNotes((current) => editingId ? current.map((item) => item._id === data._id ? data : item) : [data, ...current]); setEditingId(""); setTitle(`${lesson.title} notes`); setBody(""); setStatus("Note saved"); };
  const deleteNote = async (noteId) => { const response = await fetch(`${API_ROOT}/notes/${noteId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) { setStatus("Unable to delete note"); return; } setNotes((current) => current.filter((item) => item._id !== noteId)); };
  return <section className="lesson-notes"><header><h3>Personal Notes</h3><p>Private to you and saved to this lesson.</p></header><form onSubmit={saveNote}><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="120" required aria-label="Note title" /><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength="5000" required rows="5" placeholder="Write your notes…" aria-label="Note" /><footer><button type="submit"><FaSave /> {editingId ? "Update note" : "Save note"}</button>{editingId && <button type="button" onClick={() => { setEditingId(""); setTitle(`${lesson.title} notes`); setBody(""); }}>Cancel</button>}</footer></form>{status && <p className="lesson-notes-status" role="status">{status}</p>}<div className="lesson-notes-list">{notes.map((note) => <article key={note._id}><div><strong>{note.title}</strong><p>{note.body}</p></div><span><button type="button" onClick={() => { setEditingId(note._id); setTitle(note.title); setBody(note.body); }}>Edit</button><button type="button" onClick={() => deleteNote(note._id)} aria-label={`Delete ${note.title}`}><FaTrash /></button></span></article>)}{!notes.length && <p className="lesson-notes-empty">No notes for this lesson yet.</p>}</div></section>;
}

function LessonPlayer() {
  const { courseSlug, lessonNumber } = useParams();
  const { user } = useAuth();
  const accountCourseKey = `${user?.id || "signed-out"}:${courseSlug}`;
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const lastLocalSave = useRef(0);
  const playStartedAt = useRef(null);
  const [course, setCourse] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [courseLoading, setCourseLoading] = useState(true);
  const lessons = course?.lessons || [];
  const savedLessonIndex = Number.parseInt(localStorage.getItem(`edunova-current-lesson-${accountCourseKey}`) || "0", 10);
  const requestedIndex = Math.max(Number.parseInt(lessonNumber || String((Number.isNaN(savedLessonIndex) ? 0 : savedLessonIndex) + 1), 10) - 1, 0);
  const lessonIndex = Math.min(Number.isNaN(requestedIndex) ? 0 : requestedIndex, Math.max(lessons.length - 1, 0));
  const lesson = lessons[lessonIndex];
  const transcriptSupported = supportsLessonTranscript(lesson);
  const progressKey = `edunova-lesson-progress-${accountCourseKey}`;
  const positionsKey = `edunova-video-positions-${accountCourseKey}`;
  const currentLessonKey = `edunova-current-lesson-${accountCourseKey}`;
  const [completedLessons, setCompletedLessons] = useState(() => readArray(progressKey));
  const [videoPositions, setVideoPositions] = useState(() => readObject(positionsKey));
  const [syncMessage, setSyncMessage] = useState("");
  const [activeTool, setActiveTool] = useState("content");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaLessonIndex, setMediaLessonIndex] = useState(-1);
  const [mediaError, setMediaError] = useState("");
  const learningSignal = useLearningSignal({ courseId: course?._id, lessonId: lesson?._id });

  useEffect(() => {
    const primary = getLessonPrimaryMedia(lesson);
    if (!primary) return undefined;
    const controller = new AbortController();
    const token = localStorage.getItem("token");
    fetch(`${API_ROOT}/courses/${encodeURIComponent(courseSlug)}/lessons/${lessonIndex}/media-access`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Lesson video is unavailable."); return response.json(); })
      .then(({ url }) => { setMediaError(""); setMediaLessonIndex(lessonIndex); setMediaUrl(url); })
      .catch((error) => { if (error.name !== "AbortError") setMediaError(error.message); });
    return () => controller.abort();
  }, [courseSlug, lesson, lessonIndex]);

  const openResource = async (resource, action) => {
    const response = await fetch(`${API_ROOT}/courses/${encodeURIComponent(courseSlug)}/lessons/${lessonIndex}/resources/${resource._id}/${action}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    if (!response.ok) { setSyncMessage("This resource is unavailable"); return; }
    const blobUrl = URL.createObjectURL(await response.blob());
    if (action === "view") window.open(blobUrl, "_blank", "noopener,noreferrer");
    else { const link = document.createElement("a"); link.href = blobUrl; link.download = resource.originalName || "lesson-resource"; link.click(); }
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const syncProgress = async ({ completed = completedLessons, index = lessonIndex, seconds, studiedSeconds = 0, activity } = {}) => {
    if (studiedSeconds > 0) {
      const studySecondsKey = `edunova-study-seconds-${accountCourseKey}`;
      const previousSeconds = Number.parseInt(localStorage.getItem(studySecondsKey) || "0", 10);
      localStorage.setItem(studySecondsKey, String((Number.isNaN(previousSeconds) ? 0 : previousSeconds) + studiedSeconds));
      const studyDatesKey = `edunova-study-dates-${accountCourseKey}`;
      const dates = readArray(studyDatesKey);
      const today = new Date().toLocaleDateString("en-CA");
      localStorage.setItem(studyDatesKey, JSON.stringify(dates.includes(today) ? dates : [...dates, today]));
    }
    if (activity) {
      const activityKey = `edunova-recent-activity-${accountCourseKey}`;
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
      const response = await fetch(`${API_ROOT}/enrollments/${courseSlug}/progress`, {
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
      try { setCourse(await getPublicCourse(courseSlug, controller.signal)); } catch (error) { if (error.name !== "AbortError") setSyncMessage("Course is unavailable"); }
      if (!token) { if (!controller.signal.aborted) setCourseLoading(false); return; }
      try {
        const response = await fetch(`${API_ROOT}/enrollments/me`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) return;
        const enrollments = await response.json();
        const enrollment = enrollments.find((item) => item.course?.slug === courseSlug);
        if (!enrollment) return;
        setCourse(enrollment.course);
        setEnrolled(true);
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
    learningSignal.requestPrediction();
    setActiveTool("content");
    navigate(`/courses/${courseSlug}/learn/${index + 1}`);
  };

  if (courseLoading) return <main className="lesson-player-state"><h1>Loading lesson...</h1></main>;
  if (!course) return <main className="lesson-player-state"><h1>Course unavailable</h1><p>This course is unavailable.</p><Link to="/courses">Browse courses</Link></main>;
  if (!lesson) return <main className="lesson-player-state"><FaBookOpen /><h1>No lessons available yet</h1><p>This course does not have lesson videos.</p><Link to={`/courses/${courseSlug}`}>View course details</Link></main>;
  if (!enrolled && lessonIndex !== 0) return <main className="lesson-player-state"><h1>Lesson locked</h1><p>Enroll in this course to watch this lesson. The first lesson is available as a free preview.</p><Link to={`/courses/${courseSlug}`}>View course details</Link></main>;

  const progress = Math.round(completedLessons.length / lessons.length * 100);
  const primaryMedia = getLessonPrimaryMedia(lesson);
  const references = lessonReferences(lesson);
  const resources = supportingResources(lesson);

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
          {lessons.map((item, index) => <button type="button" className={`${index === lessonIndex ? "active" : ""} ${completedLessons.includes(index) ? "completed" : ""}`} onClick={() => openLesson(index)} disabled={!enrolled && index !== 0} key={item.title}>
            <span>{completedLessons.includes(index) ? <FaCheck /> : String(index + 1).padStart(2, "0")}</span>
            <div><strong>{item.title}</strong><small><FaClock /> {item.duration}</small></div>
            {index === lessonIndex && <FaPlay />}
          </button>)}
        </nav>
      </aside>

      <section className="lesson-workspace">
        <div className="lesson-video-shell">
          {primaryMedia && mediaUrl && mediaLessonIndex===lessonIndex && !mediaError && String(primaryMedia.mimeType || "").startsWith("audio/") ? <audio ref={videoRef} src={mediaUrl} controls {...learningSignal.mediaHandlers} /> : primaryMedia && mediaUrl && mediaLessonIndex===lessonIndex && !mediaError ? <video
            ref={videoRef}
            controls
            key={`${courseSlug}-${lessonIndex}`}
            onLoadedMetadata={(event) => { const savedPosition = Number(videoPositions[lessonIndex]) || 0; if (savedPosition < event.currentTarget.duration - 1) event.currentTarget.currentTime = savedPosition; learningSignal.mediaHandlers.onLoadedMetadata(event); syncProgress({ index: lessonIndex, activity: { activityType: "lesson_opened", lessonIndex, lessonTitle: lesson.title } }); }}
            onPlay={(event) => { learningSignal.mediaHandlers.onPlay(event); if (!playStartedAt.current) playStartedAt.current = Date.now(); }}
            onPointerDown={learningSignal.mediaHandlers.onPointerDown}
            onKeyDown={learningSignal.mediaHandlers.onKeyDown}
            onSeeking={learningSignal.mediaHandlers.onSeeking}
            onTimeUpdate={(event) => { learningSignal.mediaHandlers.onTimeUpdate(event); if (event.currentTarget.currentTime - lastLocalSave.current >= 3) { lastLocalSave.current = event.currentTarget.currentTime; saveVideoPosition(event.currentTarget.currentTime); } }}
            onPause={(event) => { learningSignal.mediaHandlers.onPause(event); const studiedSeconds = playStartedAt.current ? Math.max(Math.round((Date.now() - playStartedAt.current) / 1000), 1) : 0; playStartedAt.current = null; saveVideoPosition(event.currentTarget.currentTime); syncProgress({ index: lessonIndex, seconds: event.currentTarget.currentTime, studiedSeconds }); }}
            onEnded={() => {
              learningSignal.mediaHandlers.onEnded();
              const studiedSeconds = playStartedAt.current ? Math.max(Math.round((Date.now() - playStartedAt.current) / 1000), 1) : 0;
              playStartedAt.current = null;
              const updatedLessons = completedLessons.includes(lessonIndex) ? completedLessons : [...completedLessons, lessonIndex];
              setCompletedLessons(updatedLessons);
              localStorage.setItem(progressKey, JSON.stringify(updatedLessons));
              saveVideoPosition(0);
              syncProgress({ completed: updatedLessons, index: lessonIndex, seconds: 0, studiedSeconds, activity: { activityType: "lesson_completed", lessonIndex, lessonTitle: lesson.title } });
              learningSignal.requestPrediction();
            }}
            onError={() => setMediaError("This video format is not supported by your browser.")}
          >
            <source src={mediaUrl} type={primaryMedia.mimeType || "video/mp4"} />
            Your browser does not support HTML video.
          </video> : <div className="lesson-media-unavailable">{mediaError || (primaryMedia ? "Loading lesson video..." : "No lesson video has been uploaded.")}</div>}
        </div>

        <article className="lesson-player-content">
          <div className="lesson-player-heading"><div><small>LESSON {lessonIndex + 1} OF {lessons.length}</small><h1>{lesson.title}</h1><p>{lesson.description}</p></div>{enrolled && <button type="button" className={completedLessons.includes(lessonIndex) ? "completed" : ""} onClick={toggleComplete}><FaCheck /> {completedLessons.includes(lessonIndex) ? "Completed" : "Mark complete"}</button>}</div>
          {references.length>0&&<section className="lesson-materials"><h2>References</h2>{references.map((reference,index)=><a key={`${reference.url}-${index}`} href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label||reference.url}</a>)}</section>}
          {resources.length>0&&<section className="lesson-materials"><h2>Downloadable Resources</h2>{resources.map(resource=><div className="lesson-resource-row" key={resource._id}><div><strong>{resource.originalName}</strong><small>{fileType(resource)} · {formatFileSize(resource.size)}</small></div><span>{canPreviewResource(resource)&&<button type="button" onClick={()=>openResource(resource,"view")}>View</button>}<button type="button" onClick={()=>openResource(resource,"download")}>Download</button></span></div>)}</section>}
          <div className="lesson-player-status"><span>{syncMessage || "Your position is saved automatically"}</span><span><FaClock /> {lesson.duration}</span></div>
          <nav className="lesson-tool-tabs" aria-label="Lesson tools">{[["content","Lesson"],["summary","Summary"],...(transcriptSupported?[["transcript","Transcript"]]:[]),["notes","Personal Notes"]].map(([id,label])=><button type="button" className={activeTool===id?"active":""} aria-pressed={activeTool===id} onClick={()=>setActiveTool(id)} key={id}>{label}</button>)}</nav>
          {activeTool==="content"&&<section className="lesson-clarity-feedback" aria-labelledby="lesson-clarity-title"><div><h3 id="lesson-clarity-title">Was this lesson clear?</h3><p>Your answer is optional and helps your tutor improve the course.</p></div><div role="group" aria-label="Lesson clarity feedback"><button type="button" className={learningSignal.signal.confusionFeedback==="clear"?"selected":""} aria-pressed={learningSignal.signal.confusionFeedback==="clear"} disabled={learningSignal.feedbackState==="saving"} onClick={()=>learningSignal.saveFeedback("clear")}>Clear</button><button type="button" className={learningSignal.signal.confusionFeedback==="confused"?"selected":""} aria-pressed={learningSignal.signal.confusionFeedback==="confused"} disabled={learningSignal.feedbackState==="saving"} onClick={()=>learningSignal.saveFeedback("confused")}>I’m confused</button></div><small className={learningSignal.feedbackState==="error"?"error":""} role="status" aria-live="polite">{learningSignal.feedbackState==="saving"?"Saving…":learningSignal.feedbackState==="saved"?"Saved":learningSignal.feedbackState==="error"?learningSignal.trackingError:""}</small><small role="status" aria-live="polite">{learningSignal.predictionState==="loading"?"Reviewing your lesson activity…":learningSignal.predictionState==="success"?"Lesson activity reviewed.":learningSignal.predictionState==="error"?"Lesson activity review is unavailable.":""}</small></section>}
          {activeTool==="summary"&&<LessonSummaryPanel lesson={lesson}/>}
          {activeTool==="transcript"&&transcriptSupported&&<VideoTranscriptPanel lesson={lesson}/>}
          {activeTool==="notes"&&<LessonNotes key={JSON.stringify([user?.id, user?.role, courseSlug, lessonIndex, lesson.title])} courseSlug={courseSlug} lessonIndex={lessonIndex} lesson={lesson} user={user} />}
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

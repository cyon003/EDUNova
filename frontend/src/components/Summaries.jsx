import { useRef, useState } from "react";
import { API_ROOT } from "../utils/courseApi";
import { FaBookOpen } from "react-icons/fa";
import "../styles/Summaries.css";

export function LessonSummaryPanel({ lesson, courseSlug, lessonIndex, courseVersion, canSave = false }) {
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  async function saveSummary() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true); setStatus("");
    try {
      const response = await fetch(`${API_ROOT}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Course-Version": String(courseVersion) },
        body: JSON.stringify({ sourceType: "saved_from_summary", courseSlug, lessonIndex }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save summary. Please try again.");
      setStatus("Saved to Lesson Notes in your dashboard notebook.");
      window.dispatchEvent(new Event("edunova-learning-updated"));
    } catch (error) { setStatus(error.message || "Unable to save summary. Please try again."); }
    finally { pending.current = false; setSaving(false); }
  }
  const summary = String(lesson?.summary || "").trim();
  return <section className="lesson-summary-panel">
    <header><div><small>LESSON SUMMARY</small><h3>{lesson.title}</h3></div></header>
    {summary ? <div className="summary-copy"><p>{summary}</p><small>Provided by the course tutor.</small>{canSave ? <button className="summary-save-button" type="button" disabled={saving} onClick={saveSummary}>{saving ? "Saving…" : "Save to Lesson Notes"}</button> : <p>Enroll as a student to save this summary to Lesson Notes.</p>}<p role="status">{status}</p></div> : <div className="summary-empty"><FaBookOpen /><p>No tutor-provided summary is available for this lesson.</p></div>}
  </section>;
}

export function VideoTranscriptPanel({ lesson }) {
  const transcript = String(lesson?.transcript || "").trim();
  return <section className="video-transcript-panel">
    <header><div><small>LESSON TRANSCRIPT</small><h3>{lesson.title}</h3></div></header>
    {transcript ? <div className="transcript-copy"><p>{transcript}</p><small>Provided by the course tutor.</small></div> : <div className="summary-empty"><FaBookOpen /><p>A transcript has not been provided for this lesson.</p></div>}
  </section>;
}

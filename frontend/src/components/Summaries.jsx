import { FaBookOpen } from "react-icons/fa";
import "../styles/Summaries.css";

export function LessonSummaryPanel({ lesson }) {
  const summary = String(lesson?.summary || "").trim();
  return <section className="lesson-summary-panel">
    <header><div><small>LESSON SUMMARY</small><h3>{lesson.title}</h3></div></header>
    {summary ? <div className="summary-copy"><p>{summary}</p><small>Provided by the course tutor.</small></div> : <div className="summary-empty"><FaBookOpen /><p>No tutor-provided summary is available for this lesson.</p></div>}
  </section>;
}

export function VideoTranscriptPanel({ lesson }) {
  const transcript = String(lesson?.transcript || "").trim();
  return <section className="video-transcript-panel">
    <header><div><small>LESSON TRANSCRIPT</small><h3>{lesson.title}</h3></div></header>
    {transcript ? <div className="transcript-copy"><p>{transcript}</p><small>Provided by the course tutor.</small></div> : <div className="summary-empty"><FaBookOpen /><p>A transcript has not been provided for this lesson.</p></div>}
  </section>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaPaperPlane, FaRedo } from "react-icons/fa";
import { Link } from "react-router-dom";
import { API_ROOT } from "../utils/courseApi";
import "../styles/CourseAssistant.css";

const GENERAL_DISCLAIMER = "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials.";
const requestHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
const historyQuery = (mode, courseId, lessonId) => mode === "general" ? "mode=general" : `mode=course&courseId=${encodeURIComponent(courseId)}${lessonId ? `&lessonId=${encodeURIComponent(lessonId)}` : ""}`;

function historyMessages(items, mode, disclaimer) {
  return [...items].reverse().flatMap((item) => [
    { id: `${item._id}-user`, role: "user", text: item.userMessage, mode },
    { id: `${item._id}-assistant`, role: "assistant", mode, text: item.assistantAnswer, confidence: item.confidence, source: item.source?.id ? item.source : null, sources: mode === "course" ? (item.sources?.length ? item.sources : item.source?.id ? [item.source] : []) : [], responseType: item.answerMode, grounded: mode === "course", disclaimer: mode === "general" ? disclaimer : "" },
  ]);
}

function AiChatbot() {
  const [mode, setMode] = useState("course");
  const [courses, setCourses] = useState([]), [courseId, setCourseId] = useState(""), [lessonId, setLessonId] = useState("");
  const [messages, setMessages] = useState([]), [draft, setDraft] = useState(""), [loadingCourses, setLoadingCourses] = useState(true), [loadingHistory, setLoadingHistory] = useState(false), [sending, setSending] = useState(false), [clearing, setClearing] = useState(false);
  const [error, setError] = useState(""), [status, setStatus] = useState(""), [lastRequest, setLastRequest] = useState(null);
  const messageEnd = useRef(null), inputRef = useRef(null), submitting = useRef(false), clearingHistory = useRef(false);
  const selectedCourse = useMemo(() => courses.find((course) => course._id === courseId), [courseId, courses]);
  const loading = loadingCourses || loadingHistory;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_ROOT}/ai/courses`, { headers: requestHeaders(), signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to load courses"); return data;
    }).then((data) => { setCourses(data); setCourseId(data[0]?._id || ""); }).catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); }).finally(() => { if (!controller.signal.aborted) setLoadingCourses(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (mode === "course" && !courseId) return undefined;
    const controller = new AbortController();
    async function loadHistory() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoadingHistory(true); setError(""); setStatus(""); setMessages([]); setLastRequest(null);
      try {
        const response = await fetch(`${API_ROOT}/ai/history?${historyQuery(mode, courseId, lessonId)}&limit=50`, { headers: requestHeaders(), signal: controller.signal });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to load assistant history");
        setMessages(historyMessages(data.items || [], mode, data.disclaimer || GENERAL_DISCLAIMER));
      } catch (requestError) { if (requestError.name !== "AbortError") setError(requestError.message); }
      finally { if (!controller.signal.aborted) setLoadingHistory(false); }
    }
    loadHistory();
    return () => controller.abort();
  }, [mode, courseId, lessonId]);

  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, sending]);

  const send = async (request, addUserMessage = true) => {
    const submittedMessage = request.message.trim();
    if (!submittedMessage || (request.mode === "course" && !request.courseId) || submitting.current) return;
    const submittedRequest = { ...request, message: submittedMessage };
    submitting.current = true;
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "";
    setError(""); setStatus(""); setSending(true); setLastRequest(submittedRequest);
    if (addUserMessage) {
      const optimisticId = `pending-${Date.now()}`;
      setMessages((current) => [...current, { id: optimisticId, role: "user", mode: request.mode, text: submittedMessage }]);
    }
    try {
      const response = await fetch(`${API_ROOT}/ai/chat`, { method: "POST", headers: requestHeaders(), body: JSON.stringify(submittedRequest) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to ask the AI Assistant");
      if (data.mode !== submittedRequest.mode) throw new Error("The AI Assistant returned an incompatible response.");
      setMessages((current) => [...current, { id: data.conversationId, role: "assistant", mode: data.mode, text: data.answer, confidence: data.confidence, source: data.source, sources: data.mode === "course" ? data.sources || [] : [], responseType: data.responseType, grounded: data.grounded, disclaimer: data.disclaimer || "" }]);
      setLastRequest(null);
    } catch (requestError) { setError(requestError.message); }
    finally { submitting.current = false; setSending(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  };

  const submit = (event) => { event.preventDefault(); send(mode === "general" ? { mode, message: draft } : { mode, message: draft, courseId, ...(lessonId ? { lessonId } : {}) }); };
  const clearHistory = async () => {
    if (clearingHistory.current || sending || (mode === "course" && !courseId)) return;
    clearingHistory.current = true; setClearing(true); setError(""); setStatus("");
    try {
      const response = await fetch(`${API_ROOT}/ai/history?${historyQuery(mode, courseId, lessonId)}`, { method: "DELETE", headers: requestHeaders() });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Unable to clear history");
      setMessages([]); setLastRequest(null); setStatus(`${mode === "course" ? "Course Assistant" : "General AI Tutor"} history cleared.`);
    } catch (requestError) { setError(requestError.message); }
    finally { clearingHistory.current = false; setClearing(false); }
  };

  const general = mode === "general";
  return <main className={`assistant-page ${general ? "general-mode" : "course-mode"}`}>
    <header className="assistant-topbar"><Link to="/" aria-label="Return to EDUNova home"><FaArrowLeft /> Back</Link><div><strong>EDUNova AI Assistant</strong><small>{general ? "General educational help" : "Course-material search"}</small></div><button type="button" onClick={clearHistory} disabled={!messages.length || sending || clearing} aria-label={`Clear ${general ? "General AI Tutor" : "Course Assistant"} history`}>{clearing ? "Clearing…" : "Clear history"}</button></header>
    <nav className="assistant-mode-selector" aria-label="AI Assistant mode"><button type="button" className={!general ? "active" : ""} aria-pressed={!general} onClick={() => { setMode("course"); setDraft(""); }}>Course Assistant</button><button type="button" className={general ? "active general" : ""} aria-pressed={general} onClick={() => { setMode("general"); setDraft(""); }}>General AI Tutor</button></nav>
    <div className="assistant-layout">
      <aside className="assistant-context" aria-label="Assistant settings">
        <div className="assistant-intro"><h1>{general ? "General AI Tutor" : "Course Assistant"}</h1><p>{general ? "Ask for explanations, examples, or study help using general knowledge." : "Ask questions grounded in the EDUNova course materials you can access."}</p></div>
        {!general && <><label htmlFor="assistant-course">Course</label><select id="assistant-course" value={courseId} onChange={(event) => { setCourseId(event.target.value); setLessonId(""); }} disabled={loadingCourses || sending}>{!courses.length && <option value="">No accessible courses</option>}{courses.map((course) => <option value={course._id} key={course._id}>{course.name}</option>)}</select><label htmlFor="assistant-lesson">Lesson <span>(optional)</span></label><select id="assistant-lesson" value={lessonId} onChange={(event) => setLessonId(event.target.value)} disabled={!selectedCourse || sending}><option value="">Search the whole course</option>{selectedCourse?.lessons.map((lesson) => <option value={lesson._id} key={lesson._id}>{lesson.title}</option>)}</select><small className="assistant-privacy">Only materials your EDUNova account is allowed to access are searched.</small></>}
        {general && <p className="assistant-general-warning">General AI answers may contain mistakes. Verify important information.</p>}
      </aside>
      <section className="assistant-chat" aria-label={`${general ? "General AI Tutor" : "Course Assistant"} conversation`}>
        <div className="assistant-messages" aria-live="polite" aria-busy={sending}>
          {loading && <div className="assistant-state"><span className="assistant-loader" /><p>Loading {general ? "General AI Tutor" : "Course Assistant"} history…</p></div>}
          {!loading && !messages.length && <div className="assistant-state"><h2>{general ? "What would you like to learn?" : "What would you like to review?"}</h2><p>{general ? "Ask for an explanation, example, or study help on a general educational topic." : "Select an accessible course, then ask about a topic contained in its course or lesson materials."}</p></div>}
          {messages.map((message) => <article className={`assistant-turn ${message.role} ${message.mode}`} key={message.id}><div><small>{message.role === "user" ? "You" : message.mode === "general" ? "General AI Tutor" : "Course Assistant"}</small><p>{message.text}</p>{message.role === "assistant" && message.grounded && message.responseType === "generated" && <b className="assistant-answer-mode">AI-generated · Grounded in course material</b>}{message.role === "assistant" && message.grounded && message.responseType === "extractive" && <b className="assistant-answer-mode extractive">AI generation unavailable · Showing retrieved passage</b>}{message.role === "assistant" && !message.grounded && message.responseType === "generated" && <b className="assistant-answer-mode general">AI-generated · General knowledge · Not verified against course materials</b>}{message.role === "assistant" && message.grounded && <footer>{message.responseType === "fallback" ? <em>No close match found</em> : <span className="assistant-sources">{message.sources.map((source) => <span key={source.id}>Source: {source.filename || source.title}{source.pageNumber ? ` · page ${source.pageNumber}` : ""}{source.chunkNumber ? ` · chunk ${source.chunkNumber}` : ""}{source.lessonTitle ? ` · ${source.lessonTitle}` : ` · ${source.type}`}</span>)}</span>}{message.responseType !== "fallback" && Number.isFinite(message.confidence) && <span>{Math.round(message.confidence * 100)}% text match</span>}</footer>}</div></article>)}
          {sending && <article className={`assistant-turn assistant ${mode}`}><div><small>{general ? "General AI Tutor" : "Course Assistant"}</small><p className="assistant-thinking"><i /><i /><i /><span>{general ? "Generating a general educational answer…" : "Retrieving materials and generating a grounded answer…"}</span></p></div></article>}<div ref={messageEnd} />
        </div>
        {status && <div className="assistant-status" role="status">{status}</div>}{error && <div className="assistant-error" role="alert"><span>{error}</span>{lastRequest && <button type="button" onClick={() => send(lastRequest, false)} disabled={sending}><FaRedo /> Retry</button>}</div>}
        <form className="assistant-form" onSubmit={submit}><label htmlFor="assistant-message">{general ? "Ask the General AI Tutor" : "Ask a question about the selected course"}</label><div><textarea ref={inputRef} id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} maxLength="1000" rows="2" placeholder={general ? "Ask a general learning question..." : "For example: What does this lesson say about authentication?"} disabled={sending || (!general && !courseId)} /><button type="submit" disabled={!draft.trim() || sending || (!general && !courseId)} aria-label="Send question"><FaPaperPlane /><span>Send</span></button></div><small>{draft.length}/1000 · Enter to send, Shift+Enter for a new line</small></form>
      </section>
    </div>
  </main>;
}

export default AiChatbot;

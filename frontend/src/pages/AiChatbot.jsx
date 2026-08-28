import { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaPaperPlane, FaRedo } from "react-icons/fa";
import { Link } from "react-router-dom";
import { API_ROOT } from "../utils/courseApi";
import "../styles/CourseAssistant.css";

const GENERAL_DISCLAIMER = "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials.";
const requestHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

function historyMessages(items, disclaimer) {
  return [...items].reverse().flatMap((item) => [
    { id: `${item._id}-user`, role: "user", text: item.userMessage },
    { id: `${item._id}-assistant`, role: "assistant", text: item.assistantAnswer, responseType: item.answerMode, disclaimer },
  ]);
}

function AiChatbot() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [lastRequest, setLastRequest] = useState(null);
  const messageEnd = useRef(null);
  const inputRef = useRef(null);
  const submitting = useRef(false);
  const clearingHistory = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistory() {
      setLoading(true); setError(""); setStatus(""); setMessages([]); setLastRequest(null);
      try {
        const response = await fetch(`${API_ROOT}/ai/history?mode=general&limit=50`, { headers: requestHeaders(), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load General AI Tutor history");
        setMessages(historyMessages(data.items || [], data.disclaimer || GENERAL_DISCLAIMER));
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadHistory();
    return () => controller.abort();
  }, []);

  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, sending]);

  const send = async (request, addUserMessage = true) => {
    const submittedMessage = request.message.trim();
    if (!submittedMessage || submitting.current) return;
    const submittedRequest = { mode: "general", message: submittedMessage };
    submitting.current = true;
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "";
    setError(""); setStatus(""); setSending(true); setLastRequest(submittedRequest);
    if (addUserMessage) setMessages((current) => [...current, { id: `pending-${Date.now()}`, role: "user", text: submittedMessage }]);
    try {
      const response = await fetch(`${API_ROOT}/ai/chat`, { method: "POST", headers: requestHeaders(), body: JSON.stringify(submittedRequest) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to ask the General AI Tutor");
      if (data.mode !== "general" || data.responseType !== "generated") throw new Error("The General AI Tutor returned an incompatible response.");
      setMessages((current) => [...current, { id: data.conversationId, role: "assistant", text: data.answer, responseType: data.responseType, disclaimer: data.disclaimer || GENERAL_DISCLAIMER }]);
      setLastRequest(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      submitting.current = false; setSending(false); requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const submit = (event) => { event.preventDefault(); send({ message: draft }); };
  const clearHistory = async () => {
    if (clearingHistory.current || sending) return;
    clearingHistory.current = true; setClearing(true); setError(""); setStatus("");
    try {
      const response = await fetch(`${API_ROOT}/ai/history?mode=general`, { method: "DELETE", headers: requestHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to clear General AI Tutor history");
      setMessages([]); setLastRequest(null); setStatus("General AI Tutor history cleared.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      clearingHistory.current = false; setClearing(false);
    }
  };

  return <main className="assistant-page general-mode">
    <header className="assistant-topbar"><Link to="/" aria-label="Return to EDUNova home"><FaArrowLeft /> Back</Link><div><strong>General AI Tutor</strong><small>General educational help powered by Gemini</small></div><button type="button" onClick={clearHistory} disabled={!messages.length || sending || clearing} aria-label="Clear General AI Tutor history">{clearing ? "Clearing…" : "Clear history"}</button></header>
    <div className="assistant-layout">
      <aside className="assistant-context" aria-label="Tutor information">
        <div className="assistant-intro"><h1>General AI Tutor</h1><p>Ask for explanations, examples, or study help using general knowledge.</p></div>
        <p className="assistant-general-warning">General AI answers may contain mistakes and are not verified against EDUNova course materials. Verify important information.</p>
      </aside>
      <section className="assistant-chat" aria-label="General AI Tutor conversation">
        <div className="assistant-messages" aria-live="polite" aria-busy={sending}>
          {loading && <div className="assistant-state"><span className="assistant-loader" /><p>Loading General AI Tutor history…</p></div>}
          {!loading && !messages.length && <div className="assistant-state"><h2>What would you like to learn?</h2><p>Ask for an explanation, example, or study help on a general educational topic.</p></div>}
          {messages.map((message) => <article className={`assistant-turn ${message.role} general`} key={message.id}><div><small>{message.role === "user" ? "You" : "General AI Tutor"}</small><p>{message.text}</p>{message.role === "assistant" && message.responseType === "generated" && <b className="assistant-answer-mode general">AI-generated · General knowledge · Not verified against course materials</b>}</div></article>)}
          {sending && <article className="assistant-turn assistant general"><div><small>General AI Tutor</small><p className="assistant-thinking"><i /><i /><i /><span>Generating a general educational answer…</span></p></div></article>}<div ref={messageEnd} />
        </div>
        {status && <div className="assistant-status" role="status">{status}</div>}{error && <div className="assistant-error" role="alert"><span>{error}</span>{lastRequest && <button type="button" onClick={() => send(lastRequest, false)} disabled={sending}><FaRedo /> Retry</button>}</div>}
        <form className="assistant-form" onSubmit={submit}><label htmlFor="assistant-message">Ask the General AI Tutor</label><div><textarea ref={inputRef} id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} maxLength="1000" rows="2" placeholder="Ask a general learning question..." disabled={sending} /><button type="submit" disabled={!draft.trim() || sending} aria-label="Send question"><FaPaperPlane /><span>Send</span></button></div><small>{draft.length}/1000 · Enter to send, Shift+Enter for a new line</small></form>
      </section>
    </div>
  </main>;
}

export default AiChatbot;

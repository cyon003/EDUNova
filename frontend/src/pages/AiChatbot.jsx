import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaPaperPlane, FaRedo } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import { useSubscription } from "../hooks/useSubscription";
import SubscriptionSummary from "../components/SubscriptionSummary";
import { API_ROOT } from "../utils/courseApi";
import { useAuth } from "../hooks/useAuth";
import { isCurrentSession, sessionFetch } from "../utils/authClient.js";
import { navigationLearningContext, aiChatPayload, aiHistoryQuery, contextDisplayMetadata } from "../utils/aiLearningContext.js";
import AiLearningContext from "../components/AiLearningContext.jsx";
import "../styles/CourseAssistant.css";

const GENERAL_DISCLAIMER = "This answer uses Gemini’s general knowledge and is not verified against EDUNova course materials.";
const requestHeaders = () => ({ "Content-Type": "application/json" });

function historyMessages(items, disclaimer) {
  return [...items].reverse().flatMap((item) => [
    { id: `${item._id}-user`, role: "user", text: item.userMessage },
    { id: `${item._id}-assistant`, role: "assistant", text: item.assistantAnswer, responseType: item.answerMode, disclaimer },
  ]);
}

function AiChatbot() {
  const location = useLocation();
  const { version } = useAuth();
  const learningContext = useMemo(() => navigationLearningContext(location.state), [location.state]);
  return <AiChatbotSession key={`${version}:${JSON.stringify(learningContext)}`} learningContext={learningContext} version={version} />;
}

function AiChatbotSession({ learningContext, version }) {
  const mode = learningContext ? "lesson" : "general";
  const historyQuery = aiHistoryQuery(learningContext);
  const [context, setContext] = useState(null);
  const live = useRef(false);
  const plan = useSubscription();
  const quotaBlocked = !plan.subscription || (!plan.subscription.aiUsage.exempt && plan.subscription.aiUsage.remaining === 0);
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
    live.current = true;
    async function loadHistory() {
      setLoading(true); setError(""); setStatus(""); setMessages([]); setLastRequest(null);
      try {
        const response = await sessionFetch(`${API_ROOT}/ai/history?${historyQuery}&limit=50`, { headers: requestHeaders(), signal: controller.signal }, version);
        const data = await response.json();
        if (controller.signal.aborted || !isCurrentSession(version)) return;
        if (!response.ok) throw new Error(data.message || "Unable to load AI Tutor history");
        if (data.mode !== mode) throw new Error("AI Tutor returned an incompatible history.");
        setContext(contextDisplayMetadata(data.context));
        setMessages(historyMessages(data.items || [], data.disclaimer || GENERAL_DISCLAIMER));
      } catch (requestError) {
        if (!controller.signal.aborted && isCurrentSession(version) && requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        if (!controller.signal.aborted && isCurrentSession(version)) setLoading(false);
      }
    }
    loadHistory();
    return () => { live.current = false; controller.abort(); };
  }, [historyQuery, mode, version]);

  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, sending]);

  const send = async (request, addUserMessage = true) => {
    const submittedMessage = request.message.trim();
    if (!submittedMessage || submitting.current || loading || clearing || quotaBlocked) return;
    const submittedRequest = aiChatPayload(submittedMessage, learningContext);
    submitting.current = true;
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "";
    setError(""); setStatus(""); setSending(true); setLastRequest(submittedRequest);
    if (addUserMessage) setMessages((current) => [...current, { id: `pending-${Date.now()}`, role: "user", text: submittedMessage }]);
    try {
      const response = await sessionFetch(`${API_ROOT}/ai/chat`, { method: "POST", headers: requestHeaders(), body: JSON.stringify(submittedRequest) }, version);
      const data = await response.json();
      if (!live.current || !isCurrentSession(version)) return;
      if (data.subscription) plan.setSubscription(data.subscription);
      else if (response.ok) plan.refresh();
      if (data.code === "AI_QUOTA_EXCEEDED") { plan.setSubscription(data); setLastRequest(null); }
      if (!response.ok) throw new Error(data.message || "Unable to ask AI Tutor");
      if (data.mode !== mode || data.responseType !== "generated") throw new Error("AI Tutor returned an incompatible response.");
      setContext(contextDisplayMetadata(data.context));
      setMessages((current) => [...current, { id: data.conversationId, role: "assistant", text: data.answer, responseType: data.responseType, disclaimer: data.disclaimer || GENERAL_DISCLAIMER }]);
      setLastRequest(null);
    } catch (requestError) {
      if (live.current && isCurrentSession(version)) setError(requestError.message);
    } finally {
      submitting.current = false;
      if (live.current && isCurrentSession(version)) { setSending(false); requestAnimationFrame(() => { if (live.current) inputRef.current?.focus(); }); }
    }
  };

  const submit = (event) => { event.preventDefault(); send({ message: draft }); };
  const clearHistory = async () => {
    if (clearingHistory.current || sending) return;
    clearingHistory.current = true; setClearing(true); setError(""); setStatus("");
    try {
      const response = await sessionFetch(`${API_ROOT}/ai/history?${historyQuery}`, { method: "DELETE", headers: requestHeaders() }, version);
      const data = await response.json().catch(() => ({}));
      if (!live.current || !isCurrentSession(version)) return;
      if (!response.ok) throw new Error(data.message || "Unable to clear AI Tutor history");
      setMessages([]); setLastRequest(null); setStatus("AI Tutor history cleared.");
    } catch (requestError) {
      if (live.current && isCurrentSession(version)) setError(requestError.message);
    } finally {
      clearingHistory.current = false; if (live.current && isCurrentSession(version)) setClearing(false);
    }
  };

  return <main className={`assistant-page ${mode}-mode`}>
    <header className="assistant-topbar"><Link to="/" aria-label="Return to EDUNova home"><FaArrowLeft /> Back</Link><div><strong>AI Tutor</strong><small>{mode === "lesson" ? "Lesson help powered by Gemini" : "General educational help powered by Gemini"}</small></div><button type="button" onClick={clearHistory} disabled={!messages.length || sending || clearing} aria-label="Clear AI Tutor history">{clearing ? "Clearing…" : "Clear history"}</button></header>
    <div className="assistant-layout">
      <aside className="assistant-context" aria-label="Tutor information">
        <div className="assistant-intro"><h1>AI Tutor</h1><p>{mode === "lesson" ? "Ask about your lesson using the attached learning context." : "Ask for explanations, examples, or study help using general knowledge."}</p></div>
        {mode === "lesson" && <AiLearningContext context={context} />}
        <SubscriptionSummary subscription={plan.subscription} error={plan.error} onRetry={plan.refresh} />
        <p className="assistant-general-warning">{mode === "lesson" ? "AI uses available lesson context and may make mistakes. Transcript excerpts are not aligned to the video timestamp. Verify important details with your tutor." : "General AI answers may contain mistakes and are not verified against EDUNova course materials. Verify important information."}</p>
      </aside>
      <section className="assistant-chat" aria-label="AI Tutor conversation">
        <div className="assistant-messages" aria-live="polite" aria-busy={sending}>
          {loading && <div className="assistant-state"><span className="assistant-loader" /><p>Loading AI Tutor history…</p></div>}
          {!loading && !messages.length && <div className="assistant-state"><h2>What would you like to learn?</h2><p>{mode === "lesson" ? "Your lesson context is attached. Choose what you would like to ask." : "Ask for an explanation, example, or study help on a general educational topic."}</p></div>}
          {messages.map((message) => <article className={`assistant-turn ${message.role} general`} key={message.id}><div><small>{message.role === "user" ? "You" : "AI Tutor"}</small><p>{message.text}</p>{message.role === "assistant" && message.responseType === "generated" && <b className="assistant-answer-mode general">{mode === "lesson" ? "AI-generated · Lesson context · Verify important details" : "AI-generated · General knowledge · Not verified against course materials"}</b>}</div></article>)}
          {sending && <article className="assistant-turn assistant general"><div><small>AI Tutor</small><p className="assistant-thinking"><i /><i /><i /><span>{mode === "lesson" ? "Generating an answer with lesson context…" : "Generating a general educational answer…"}</span></p></div></article>}<div ref={messageEnd} />
        </div>
        {status && <div className="assistant-status" role="status">{status}</div>}{error && <div className="assistant-error" role="alert"><span>{error}</span>{lastRequest && <button type="button" onClick={() => send(lastRequest, false)} disabled={loading || sending || clearing || quotaBlocked}><FaRedo /> Retry</button>}</div>}
        <form className="assistant-form" onSubmit={submit}><label htmlFor="assistant-message">Ask AI Tutor</label><div><textarea ref={inputRef} id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} maxLength="1000" rows="2" placeholder={mode === "lesson" ? "What would you like to understand about this lesson?" : "Ask a general learning question..."} disabled={loading || sending || clearing || quotaBlocked} /><button type="submit" disabled={!draft.trim() || loading || sending || clearing || quotaBlocked} aria-label="Send question"><FaPaperPlane /><span>Send</span></button></div><small>{draft.length}/1000 · Enter to send, Shift+Enter for a new line</small></form>
      </section>
    </div>
  </main>;
}

export default AiChatbot;

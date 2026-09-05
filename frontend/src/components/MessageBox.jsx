import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaComments, FaPaperPlane, FaSearch, FaTimes, FaTrash } from "react-icons/fa";
import { io } from "socket.io-client";
import "../styles/MessageBox.css";

import { API_ROOT } from "../utils/courseApi";

const API_URL = `${API_ROOT}/messages`;
const SOCKET_URL = API_ROOT.replace(/\/api$/, "");

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [String(message._id), message]));
  for (const message of incoming) byId.set(String(message._id), { ...byId.get(String(message._id)), ...message });
  return [...byId.values()].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
}

async function apiRequest(token, path = "", options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Messaging is unavailable");
  return data;
}

function getUser() {
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
}

function messageTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBox() {
  const user = getUser();
  const userId = user?._id || user?.id;
  const token = localStorage.getItem("token");
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [activeContactId, setActiveContactId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const messageEndRef = useRef(null);
  const activeContactIdRef = useRef("");
  const openRef = useRef(false);

  const activeContact = contacts.find((contact) => String(contact._id) === String(activeContactId)) || null;
  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.email, ...(contact.courses || []).map((course) => course.name)]
        .some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [contacts, search]);

  const loadUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest(token, "/unread-count");
      setUnreadCount(Number(data.count) || 0);
    } catch {
      // The main contact request displays connection errors when the popup is open.
    }
  }, [token]);

  const loadContacts = useCallback(async (showLoading = false) => {
    if (!token) return;
    if (showLoading) setLoadingContacts(true);
    try {
      const items = await apiRequest(token, "/contacts");
      setContacts(items);
      const currentId = activeContactIdRef.current;
      if (!items.some((item) => String(item._id) === String(currentId))) {
        const nextContact = items[0] || null;
        const nextId = nextContact?._id || "";
        activeContactIdRef.current = nextId;
        setActiveContactId(nextId);
        setSelectedCourseId(nextContact?.courses?.[0]?._id || "");
        setMessages([]);
      }
      setStatus(items.length ? "" : "No course contacts are available yet.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (showLoading) setLoadingContacts(false);
    }
  }, [token]);

  const loadMessages = useCallback(async (contactId, showLoading = false) => {
    if (!token || !contactId) return;
    if (showLoading) setLoadingMessages(true);
    try {
      const items = await apiRequest(token, `/${contactId}`);
      if (String(activeContactIdRef.current) === String(contactId)) {
        setMessages((current) => mergeMessages(current, items));
        setStatus("");
      }
      await loadUnreadCount();
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  }, [token, loadUnreadCount]);

  const selectContact = (contact) => {
    activeContactIdRef.current = contact._id;
    setActiveContactId(contact._id);
    setSelectedCourseId(contact.courses?.[0]?._id || "");
    setMessages([]);
    setStatus("");
  };

  useEffect(() => {
    const initialTimer = window.setTimeout(loadUnreadCount, 0);
    return () => window.clearTimeout(initialTimer);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open || !token) return undefined;
    const initialTimer = window.setTimeout(() => loadContacts(true), 0);
    return () => window.clearTimeout(initialTimer);
  }, [open, token, loadContacts]);

  useEffect(() => {
    if (!open || !activeContactId || !token) return undefined;
    const initialTimer = window.setTimeout(() => loadMessages(activeContactId, true), 0);
    return () => window.clearTimeout(initialTimer);
  }, [open, activeContactId, token, loadMessages]);

  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    if (!token || !userId) return undefined;
    const socket = io(SOCKET_URL || undefined, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    const recoverFromRest = () => {
      loadUnreadCount();
      loadContacts(false);
      if (openRef.current && activeContactIdRef.current) loadMessages(activeContactIdRef.current, false);
    };

    socket.on("connect", recoverFromRest);
    socket.on("message:new", (message) => {
      const senderId = String(message.sender);
      const recipientId = String(message.recipient);
      const contactId = senderId === String(userId) ? recipientId : senderId;
      const isOpenConversation = openRef.current && String(activeContactIdRef.current) === contactId;

      if (isOpenConversation) {
        setMessages((current) => mergeMessages(current, [message]));
        if (recipientId === String(userId)) loadMessages(contactId, false);
      }
      setContacts((current) => current.map((contact) => String(contact._id) === contactId
        ? {
            ...contact,
            lastMessage: message,
            unreadCount: recipientId === String(userId) && !isOpenConversation
              ? Number(contact.unreadCount || 0) + 1
              : contact.unreadCount,
          }
        : contact));
    });
    socket.on("unread:update", ({ count }) => setUnreadCount(Number(count) || 0));
    socket.on("message:read", ({ messageIds, readerId, readAt }) => {
      setMessages((current) => current.map((message) => {
        const selectedById = Array.isArray(messageIds) && messageIds.map(String).includes(String(message._id));
        const selectedConversation = !messageIds && String(message.sender) === String(userId)
          && String(message.recipient) === String(readerId);
        return selectedById || selectedConversation ? { ...message, read: true, readAt } : message;
      }));
      loadContacts(false);
    });
    socket.on("message:deleted", ({ messageId }) => {
      setMessages((current) => current.filter((message) => String(message._id) !== String(messageId)));
      loadContacts(false);
    });
    socket.on("connect_error", (error) => setStatus(error.data?.message || "Real-time messaging is reconnecting…"));

    return () => socket.disconnect();
  }, [token, userId, loadContacts, loadMessages, loadUnreadCount]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !activeContact || sending) return;
    setSending(true);
    try {
      const message = await apiRequest(token, "", {
        method: "POST",
        body: JSON.stringify({ recipientId: activeContact._id, courseId: selectedCourseId, content: draft.trim() }),
      });
      setMessages((current) => mergeMessages(current, [message]));
      setDraft("");
      setStatus("");
      loadContacts(false);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (message) => {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    try {
      await apiRequest(token, `/${message._id}`, { method: "DELETE" });
      setMessages((current) => current.filter((item) => item._id !== message._id));
      setStatus("Message deleted.");
      loadContacts(false);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="message-box-wrap">
      <button type="button" className="message-trigger" aria-label="Messages" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <FaComments />
        {unreadCount > 0 && <span className="message-trigger-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="message-box" aria-label="Messages">
          <header><div><strong>Messages</strong><small>Student and instructor chat</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close messages"><FaTimes /></button></header>
          <div className="message-layout">
            <aside>
              <label className="message-search"><FaSearch /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" aria-label="Search message contacts" /></label>
              {loadingContacts && <p className="message-sidebar-state">Loading contacts…</p>}
              {!loadingContacts && filteredContacts.map((contact) => (
                <button type="button" className={activeContact?._id === contact._id ? "active" : undefined} onClick={() => selectContact(contact)} key={contact._id}>
                  <span>{contact.name?.[0]?.toUpperCase()}</span><div><strong>{contact.name}</strong><small>{contact.lastMessage?.content || contact.courses?.map((course) => course.name).join(", ") || contact.role}</small></div>
                  {contact.unreadCount > 0 && <b className="message-contact-badge">{contact.unreadCount}</b>}
                </button>
              ))}
              {!loadingContacts && contacts.length > 0 && !filteredContacts.length && <p className="message-sidebar-state">No matching contacts.</p>}
            </aside>
            <div className="message-conversation">
              {activeContact && <div className="message-contact"><div><strong>{activeContact.name}</strong><small>{activeContact.email}</small></div>{activeContact.courses?.length > 0 && <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} aria-label="Conversation course">{activeContact.courses.map((course) => <option value={course._id} key={course._id}>{course.name}</option>)}</select>}</div>}
              <div className="message-list">
                {loadingMessages && <p className="message-empty">Loading conversation…</p>}
                {messages.map((message) => (
                  <div className={String(message.sender) === String(userId) ? "sent" : "received"} key={message._id}>
                    <p>{message.content}</p><footer><time>{messageTime(message.createdAt)}</time>{String(message.sender) === String(userId) && <button type="button" onClick={() => deleteMessage(message)} aria-label="Delete message"><FaTrash /></button>}</footer>
                  </div>
                ))}
                {!loadingMessages && !messages.length && activeContact && <p className="message-empty">Start a conversation with {activeContact.name}.</p>}
                {!activeContact && !loadingContacts && <p className="message-empty">Choose a course contact to begin.</p>}
                {status && <p className="message-status">{status}</p>}
                <div ref={messageEndRef} />
              </div>
              <form onSubmit={sendMessage}><div className="message-compose"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." aria-label="Message" maxLength="2000" disabled={!activeContact || sending} /><small>{draft.length}/2000</small></div><button type="submit" disabled={!draft.trim() || !activeContact || sending} aria-label="Send message"><FaPaperPlane /></button></form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default MessageBox;

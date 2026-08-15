import { useEffect, useState } from "react";
import { FaComments, FaPaperPlane, FaTimes } from "react-icons/fa";
import "../styles/MessageBox.css";

const API_URL = "http://localhost:5050/api/messages";

async function apiRequest(token, path = "", options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Messaging is unavailable");
  return data;
}

function getUser() {
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
}

function MessageBox() {
  const user = getUser();
  const token = localStorage.getItem("token");
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open || !token) return;
    apiRequest(token, "/contacts")
      .then((items) => {
        setContacts(items);
        if (!activeContact && items.length) setActiveContact(items[0]);
        setStatus(items.length ? "" : "No contacts are available yet.");
      })
      .catch((error) => setStatus(error.message));
  }, [open, token, activeContact]);

  useEffect(() => {
    if (!open || !activeContact) return;
    apiRequest(token, `/${activeContact._id}`)
      .then(setMessages)
      .catch((error) => setStatus(error.message));
  }, [open, token, activeContact]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !activeContact) return;
    try {
      const message = await apiRequest(token, "", {
        method: "POST",
        body: JSON.stringify({ recipientId: activeContact._id, content: draft }),
      });
      setMessages((current) => [...current, message]);
      setDraft("");
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="message-box-wrap">
      <button type="button" className="message-trigger" aria-label="Messages" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <FaComments /><span />
      </button>
      {open && (
        <section className="message-box" aria-label="Messages">
          <header><div><strong>Messages</strong><small>Student and instructor chat</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close messages"><FaTimes /></button></header>
          <div className="message-layout">
            <aside>
              {contacts.map((contact) => (
                <button type="button" className={activeContact?._id === contact._id ? "active" : undefined} onClick={() => setActiveContact(contact)} key={contact._id}>
                  <span>{contact.name?.[0]?.toUpperCase()}</span><div><strong>{contact.name}</strong><small>{contact.role}</small></div>
                </button>
              ))}
            </aside>
            <div className="message-conversation">
              {activeContact && <div className="message-contact"><strong>{activeContact.name}</strong><small>{activeContact.email}</small></div>}
              <div className="message-list">
                {messages.map((message) => (
                  <div className={String(message.sender) === String(user?.id) ? "sent" : "received"} key={message._id}>
                    <p>{message.content}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                  </div>
                ))}
                {!messages.length && activeContact && <p className="message-empty">Start a conversation with {activeContact.name}.</p>}
                {status && <p className="message-status">{status}</p>}
              </div>
              <form onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." aria-label="Message" disabled={!activeContact} /><button type="submit" disabled={!draft.trim() || !activeContact} aria-label="Send message"><FaPaperPlane /></button></form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default MessageBox;

import { useCallback, useEffect, useRef, useState } from "react";
import { FaBell, FaCheckDouble } from "react-icons/fa";
import { Link } from "react-router-dom";
import "../styles/NotificationBell.css";
import { API_ROOT } from "../utils/courseApi";

const API = `${API_ROOT}/notifications`;

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

async function notificationRequest(path = "", options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to update notifications");
  return data;
}

export default function NotificationBell() {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!localStorage.getItem("token")) return;
    notificationRequest()
      .then(setItems)
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = items.filter((item) => !item.isRead).length;

  const markRead = async (item) => {
    if (item.isRead) return;
    try {
      await notificationRequest(`/${item._id}/read`, { method: "PATCH" });
      setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, isRead: true } : entry));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationRequest("/read-all", { method: "PATCH" });
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="notification-bell" ref={rootRef}>
      <button type="button" className="notification-bell-trigger" onClick={() => setOpen((current) => !current)} aria-label={`${unread} unread notifications`} aria-expanded={open}>
        <FaBell />{unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <section className="notification-bell-panel">
          <header><div><strong>Notifications</strong><small>{unread ? `${unread} unread` : "You are all caught up"}</small></div>{unread > 0 && <button type="button" onClick={markAllRead}><FaCheckDouble /> Mark all read</button>}</header>
          {error && <p className="notification-bell-error">{error}</p>}
          <div className="notification-bell-list">
            {items.map((item) => {
              const content = <><i /><span><strong>{item.title}</strong><p>{item.message}</p><small>{relativeTime(item.createdAt)} · {item.source}</small></span></>;
              return item.course?.slug
                ? <Link to={`/courses/${item.course.slug}`} className={item.isRead ? "read" : "unread"} onClick={() => markRead(item)} key={item._id}>{content}</Link>
                : <button type="button" className={item.isRead ? "read" : "unread"} onClick={() => markRead(item)} key={item._id}>{content}</button>;
            })}
            {!items.length && !error && <p className="notification-bell-empty">No notifications yet.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

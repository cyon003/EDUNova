import { FaChalkboardTeacher, FaSignOutAlt, FaUsers } from "react-icons/fa";
import "../styles/RoleDashboard.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function AdminDashboard() {
  const user = getStoredUser();

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/auth";
  };

  return (
    <main className="role-dashboard role-dashboard--admin">
      <header className="role-dashboard__header">
        <div>
          <span className="role-dashboard__eyebrow">EDUNOVA ADMIN</span>
          <h1>Welcome, {user?.name || "Administrator"}</h1>
          <p>Manage your learning platform from this dashboard.</p>
        </div>
        <button type="button" onClick={handleLogout} className="role-dashboard__logout">
          <FaSignOutAlt /> Log out
        </button>
      </header>

      <section className="role-dashboard__grid" aria-label="Admin tools">
        <article className="role-dashboard__card">
          <FaUsers />
          <h2>Manage users</h2>
          <p>Review student accounts and account activity.</p>
        </article>
        <article className="role-dashboard__card">
          <FaChalkboardTeacher />
          <h2>Manage tutors</h2>
          <p>Create, update, suspend, and reactivate tutor accounts.</p>
        </article>
      </section>
    </main>
  );
}

export default AdminDashboard;

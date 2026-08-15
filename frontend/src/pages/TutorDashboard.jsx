import { FaBookOpen, FaChartLine, FaSignOutAlt } from "react-icons/fa";
import "../styles/RoleDashboard.css";
import MessageBox from "../components/MessageBox";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function TutorDashboard() {
  const user = getStoredUser();

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/auth";
  };

  return (
    <main className="role-dashboard role-dashboard--tutor">
      <header className="role-dashboard__header">
        <div>
          <span className="role-dashboard__eyebrow">EDUNOVA TUTOR</span>
          <h1>Welcome, {user?.name || "Tutor"}</h1>
          <p>Your teaching workspace is ready to customize.</p>
        </div>
        <div className="role-dashboard__actions">
          <MessageBox />
          <button type="button" onClick={handleLogout} className="role-dashboard__logout">
            <FaSignOutAlt /> Log out
          </button>
        </div>
      </header>

      <section className="role-dashboard__grid" aria-label="Tutor tools">
        <article className="role-dashboard__card">
          <FaBookOpen />
          <h2>My courses</h2>
          <p>Create and organize the courses you teach.</p>
        </article>
        <article className="role-dashboard__card">
          <FaChartLine />
          <h2>Student progress</h2>
          <p>Track participation and learning progress.</p>
        </article>
      </section>
    </main>
  );
}

export default TutorDashboard;

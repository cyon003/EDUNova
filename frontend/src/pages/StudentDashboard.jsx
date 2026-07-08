import "../styles/StudentDashboard.css";
function StudentDashboard() {
  return (
    <div className="student-dashboard">
      <aside className="sidebar">
        <h2>EDUNova</h2>
        <a className="active">Dashboard</a>
        <a>My Courses</a>
        <a>Progress</a>
        <a>AI Summary</a>
        <a>AI Chatbot</a>
        <a>Profile</a>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1>Student Dashboard</h1>
            <p>Welcome back, Lwin. Continue your learning today.</p>
          </div>
          <button>Browse Courses</button>
        </div>
        <section className="stats-grid">
          <div className="stat-card">
            <h3>3</h3>
            <p>Enrolled Courses</p>
          </div>
          <div className="stat-card">
            <h3>70%</h3>
            <p>Average Progress</p>
          </div>
          <div className="stat-card">
            <h3>12</h3>
            <p>Lessons Completed</p>
          </div>
          <div className="stat-card">
            <h3>5</h3>
            <p>Saved Summaries</p>
          </div>
        </section>
        <section className="content-grid">
          <div className="courses-card">
            <h2>My Courses</h2>
            <div className="course-item">
              <div>
                <h3>Python Basics</h3>
                <p>Lesson 3: Functions in Python</p>
              </div>
              <span>80%</span>
            </div>
            <div className="course-item">
              <div>
                <h3>React Development</h3>
                <p>Lesson 5: Components</p>
              </div>
              <span>65%</span>
            </div>
            <div className="course-item">
              <div>
                <h3>Database Basics</h3>
                <p>Lesson 2: MongoDB</p>
              </div>
              <span>55%</span>
            </div>
          </div>
          <div className="ai-card">
            <h2>AI Learning Tools</h2>
            <div className="ai-box">
              <h3>AI Summary Generator</h3>
              <p>Summarize long lessons into short notes.</p>
              <button>Generate Summary</button>
            </div>
            <div className="ai-box">
              <h3>AI Chatbot</h3>
              <p>Ask questions when you do not understand lessons.</p>
              <button>Ask AI</button>
            </div>
          </div>
        </section>
        <section className="progress-section">
          <h2>Learning Progress</h2>
          <div className="progress-item">
            <p>Python Basics</p>
            <div className="progress-bar"><span style={{ width: "80%" }}></span></div>
          </div>
          <div className="progress-item">
            <p>React Development</p>
            <div className="progress-bar"><span style={{ width: "65%" }}></span></div>
          </div>
          <div className="progress-item">
            <p>Database Basics</p>
            <div className="progress-bar"><span style={{ width: "55%" }}></span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
export default StudentDashboard;
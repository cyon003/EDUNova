import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaBan,
  FaBookOpen,
  FaBrain,
  FaChartLine,
  FaCheckCircle,
  FaChevronRight,
  FaClipboardCheck,
  FaComments,
  FaCrown,
  FaGraduationCap,
  FaFileAlt,
  FaFilePdf,
  FaLayerGroup,
  FaMagic,
  FaPlay,
  FaPlus,
  FaRobot,
  FaSearch,
  FaShieldAlt,
  FaStar,
  FaUsers,
  FaUpload,
  FaVideo,
} from "react-icons/fa";
import "../styles/Prototype.css";

const roles = {
  student: {
    label: "Student",
    name: "Maya Chen",
    email: "maya@student.edunova.edu",
    initials: "MC",
    description: "Discover courses, learn with AI, chat, and climb the ranking.",
    nav: ["Overview", "Available courses", "AI Assistant", "Ranking", "Messages"],
  },
  tutor: {
    label: "Tutor",
    name: "Dr. Noah Williams",
    email: "noah@tutor.edunova.edu",
    initials: "NW",
    description: "Create courses, follow learners, and review AI summaries.",
    nav: ["Overview", "My courses", "Create course", "Students", "Messages"],
  },
  admin: {
    label: "Admin",
    name: "Alicia Morgan",
    email: "alicia@admin.edunova.edu",
    initials: "AM",
    description: "Verify roles, approve courses, and monitor the platform.",
    nav: ["Overview", "User roles", "Course approvals", "Reports", "Settings"],
  },
};

const courses = [
  { title: "UI/UX Design Systems", tutor: "Dr. Noah Williams", level: "Intermediate", rating: "4.9", students: "2.4k", progress: 74, tone: "amber" },
  { title: "Applied Machine Learning", tutor: "Prof. Sarah Kim", level: "Advanced", rating: "4.8", students: "1.8k", progress: 38, tone: "teal" },
  { title: "Full-Stack Web Development", tutor: "James Carter", level: "Beginner", rating: "4.7", students: "3.1k", progress: 0, tone: "green" },
];

const workflows = {
  student: ["Register email", "Role verified", "Explore courses", "Enroll", "Learn with AI", "Rank & chat"],
  tutor: ["Register email", "Tutor verified", "Create course", "Admin approval", "Publish", "Monitor students"],
  admin: ["Secure sign in", "Review accounts", "Assign roles", "Approve courses", "Moderate", "View reports"],
};

function RoleGate({ onEnter }) {
  const [selected, setSelected] = useState("student");
  const [authMode, setAuthMode] = useState("login");
  const [verified, setVerified] = useState(false);
  return (
    <div className="proto-gate">
      <div className="proto-orb proto-orb-one" />
      <div className="proto-orb proto-orb-two" />
      <header className="proto-gate-nav">
        <Link to="/" className="proto-brand"><span><FaGraduationCap /></span>EDUNOVA</Link>
        <span className="proto-badge">Advisor prototype</span>
      </header>
      <main className="proto-gate-main">
        <div className="proto-gate-copy">
          <span className="proto-kicker">AI-powered learning ecosystem</span>
          <h1>One platform.<br /><em>Three experiences.</em></h1>
          <p>Select a role to preview how EDUNova automatically personalizes the platform after checking the registered email against the Admin database.</p>
          <div className="proto-role-flow">
            <span>Email registration</span><FaChevronRight /><span>Admin database check</span><FaChevronRight /><strong>Role dashboard</strong>
          </div>
        </div>
        <div className="proto-gate-card">
          <div className="proto-card-head"><div><span>Interactive demo</span><h2>Continue as</h2></div><FaShieldAlt /></div>
          <div className="proto-role-list">
            {Object.entries(roles).map(([key, role]) => (
              <button key={key} className={`proto-role-option ${selected === key ? "active" : ""}`} onClick={() => setSelected(key)}>
                <span className="proto-role-icon">{key === "student" ? <FaGraduationCap /> : key === "tutor" ? <FaBookOpen /> : <FaShieldAlt />}</span>
                <span><strong>{role.label}</strong><small>{role.description}</small></span>
                <span className="proto-radio" />
              </button>
            ))}
          </div>
          <div className="proto-auth-tabs"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Log in</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Register</button></div>
          <div className="proto-demo-form">{authMode === "register" && <input aria-label="Full name" placeholder="Full name" defaultValue={roles[selected].name} />}<input aria-label="Email address" value={roles[selected].email} readOnly /><input aria-label="Password" type="password" defaultValue="edunova2026" /></div>
          {verified && <div className="proto-verified"><FaCheckCircle /> Email found in Admin database · {roles[selected].label} role assigned</div>}
          <button className="proto-primary" onClick={() => verified ? onEnter(selected) : setVerified(true)}>{verified ? `Open ${roles[selected].label} experience` : authMode === "login" ? "Verify & log in" : "Create account & verify role"} <FaArrowRight /></button>
          <p className="proto-demo-note"><FaCheckCircle /> Demo data only — no account required</p>
        </div>
      </main>
    </div>
  );
}

function Workflow({ role }) {
  return (
    <div className="proto-workflow">
      <div className="proto-section-title"><div><span>End-to-end journey</span><h2>{roles[role].label} workflow</h2></div><span className="proto-live"><i /> Live prototype</span></div>
      <div className="proto-flow-steps">
        {workflows[role].map((step, index) => <div className="proto-flow-step" key={step}><b>{index + 1}</b><span>{step}</span>{index < workflows[role].length - 1 && <FaChevronRight />}</div>)}
      </div>
    </div>
  );
}

function StudentView({ notify }) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  return (
    <>
      <section className="proto-hero-card">
        <div><span className="proto-kicker">Continue your journey</span><h1>Good afternoon, Maya.</h1><p>You are 26 minutes away from reaching today’s learning goal.</p><button className="proto-primary" onClick={() => notify("Opening your current UI/UX lesson")}>Resume learning <FaPlay /></button></div>
        <div className="proto-goal-ring"><div><strong>74%</strong><span>weekly goal</span></div></div>
      </section>
      <div className="proto-metrics">
        <Metric icon={<FaBookOpen />} value="3" label="Active courses" />
        <Metric icon={<FaMagic />} value="18" label="Day streak" />
        <Metric icon={<FaCrown />} value="#48" label="Global rank" />
        <Metric icon={<FaStar />} value="1,840" label="Learning points" />
      </div>
      <section className="proto-panel">
        <div className="proto-section-title"><div><span>Personalized for you</span><h2>Available courses</h2></div><button className="proto-text-btn">View all <FaArrowRight /></button></div>
        <div className="proto-course-grid">
          {courses.map((course, index) => <CourseCard key={course.title} course={course} action={index === 0 ? "Continue" : "Enroll now"} onAction={() => notify(index === 0 ? "Course resumed" : `Enrolled in ${course.title}`)} />)}
        </div>
      </section>
      <div className="proto-two-col">
        <section className="proto-panel proto-ai-card">
          <span className="proto-kicker">AI learning tools</span><h2>Understand more, in less time.</h2><p>Ask questions about any lesson or generate a focused summary from your course material.</p>
          <div className="proto-ai-actions"><button onClick={() => setAssistantOpen(true)}><FaRobot /> Ask AI Assistant</button><button onClick={() => setSummaryOpen(true)}><FaLayerGroup /> Summarize lesson</button></div>
        </section>
        <section className="proto-panel proto-ranking">
          <div className="proto-section-title"><div><span>Weekly leaderboard</span><h2>Top learners</h2></div><FaCrown /></div>
          {["Lina Park", "Arun Patel", "You · Maya Chen"].map((name, i) => <div className={`proto-rank-row ${i === 2 ? "me" : ""}`} key={name}><b>{i === 0 ? "🥇" : i === 1 ? "🥈" : "48"}</b><span>{name}</span><strong>{[2840, 2510, 1840][i]} pts</strong></div>)}
        </section>
      </div>
      <button className="proto-chat-fab" onClick={() => notify("Community chat opened — 12 classmates online")}><FaComments /><span>Community chat</span><i>12</i></button>
      {assistantOpen && <Modal title="AI Assistant" icon={<FaRobot />} onClose={() => setAssistantOpen(false)}><div className="proto-ai-chat"><div className="ai-message">Hi Maya! I can explain concepts from your current course. What are you learning?</div><div className="user-message">What is the difference between a component and a variant?</div><div className="ai-message">A component is a reusable UI element. A variant is an alternative state or style of that same component—like primary and secondary buttons.</div><div className="proto-prompt"><input value="Ask a follow-up question..." readOnly /><button><FaArrowRight /></button></div></div></Modal>}
      {summaryOpen && <Modal title="AI Course Summary" icon={<FaBrain />} onClose={() => setSummaryOpen(false)}><div className="proto-summary"><span>Lesson 8 · Design Systems</span><h3>Key ideas</h3><ul><li>Design tokens keep color, type, and spacing consistent.</li><li>Components turn repeated patterns into reusable building blocks.</li><li>Documentation connects design decisions with implementation.</li></ul><div className="proto-summary-tip"><FaMagic /><p><strong>AI study tip</strong> Create one button component with three variants before your next lesson.</p></div></div></Modal>}
    </>
  );
}

function TutorView({ notify }) {
  return (
    <>
      <section className="proto-hero-card tutor"><div><span className="proto-kicker">Tutor workspace</span><h1>Your learners are making progress.</h1><p>82% of active students completed this week’s learning goal.</p><button className="proto-primary" onClick={() => notify("Course builder opened")}>Create new course <FaPlus /></button></div><div className="proto-tutor-visual"><FaChartLine /><strong>+18%</strong><span>engagement this month</span></div></section>
      <div className="proto-metrics"><Metric icon={<FaBookOpen />} value="6" label="Published courses" /><Metric icon={<FaUsers />} value="3,248" label="Total students" /><Metric icon={<FaStar />} value="4.9" label="Average rating" /><Metric icon={<FaClipboardCheck />} value="86%" label="Completion rate" /></div>
      <div className="proto-two-col wide-left">
        <section className="proto-panel"><div className="proto-section-title"><div><span>Course management</span><h2>Your courses</h2></div><button className="proto-text-btn">Manage all <FaArrowRight /></button></div>{courses.slice(0, 2).map((course, i) => <div className="proto-manage-row" key={course.title}><span className={`proto-mini-cover ${course.tone}`}><FaBookOpen /></span><div><strong>{course.title}</strong><small>{[1248, 834][i]} students · Updated 2 days ago</small></div><span className="proto-status">Published</span><button onClick={() => notify(`Opening ${course.title}`)}>Manage</button></div>)}</section>
        <section className="proto-panel"><div className="proto-section-title"><div><span>Needs attention</span><h2>Student questions</h2></div><FaComments /></div>{["How do variants inherit properties?", "Could you review my final project?", "Is the quiz deadline flexible?"].map((q, i) => <div className="proto-question" key={q}><span>{["MC", "AP", "SL"][i]}</span><div><strong>{q}</strong><small>{["Maya Chen", "Arun Patel", "Sofia Lee"][i]} · {i + 1}h ago</small></div></div>)}</section>
      </div>
      <section className="proto-panel"><div className="proto-section-title"><div><span>Learning analytics</span><h2>Weekly student activity</h2></div><select aria-label="Analytics period"><option>Last 7 days</option></select></div><div className="proto-chart">{[46, 68, 54, 82, 72, 94, 78].map((height, i) => <div key={i}><span style={{ height: `${height}%` }} /><small>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</small></div>)}</div></section>
    </>
  );
}

function AdminView({ notify }) {
  const [approved, setApproved] = useState(false);
  return (
    <>
      <section className="proto-hero-card admin"><div><span className="proto-kicker">Administration center</span><h1>Platform health is excellent.</h1><p>All core services are operational. Three items require review.</p><button className="proto-primary" onClick={() => notify("System report generated")}>View system report <FaChartLine /></button></div><div className="proto-health"><i /><strong>99.9%</strong><span>platform uptime</span></div></section>
      <div className="proto-metrics"><Metric icon={<FaUsers />} value="12,840" label="Registered users" /><Metric icon={<FaGraduationCap />} value="10,920" label="Students" /><Metric icon={<FaBookOpen />} value="286" label="Tutors" /><Metric icon={<FaShieldAlt />} value="8" label="Administrators" /></div>
      <div className="proto-two-col wide-left">
        <section className="proto-panel"><div className="proto-section-title"><div><span>Role management</span><h2>Pending registrations</h2></div><button className="proto-text-btn">View database <FaArrowRight /></button></div>{[{ name: "Emma Wilson", email: "emma@tutor.edunova.edu", role: "Tutor" }, { name: "Daniel Cho", email: "daniel@student.edunova.edu", role: "Student" }, { name: "Ivy Brooks", email: "ivy@tutor.edunova.edu", role: "Tutor" }].map((user) => <div className="proto-user-row" key={user.email}><span>{user.name.split(" ").map(n => n[0]).join("")}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><em>{user.role}</em><button onClick={() => notify(`${user.name}'s ${user.role} role approved`)}><FaCheckCircle /> Approve</button></div>)}</section>
        <section className="proto-panel proto-approval"><div className="proto-section-title"><div><span>Course approval</span><h2>Ready for review</h2></div><span className="proto-count">1</span></div><div className="proto-approval-cover"><FaBrain /><span>New submission</span></div><h3>Generative AI Fundamentals</h3><p>Submitted by Dr. Noah Williams · 18 lessons</p><div className="proto-approval-actions"><button onClick={() => notify("Course preview opened")}>Preview</button><button className={approved ? "approved" : ""} onClick={() => { setApproved(true); notify("Course approved and queued for publishing"); }}>{approved ? <><FaCheckCircle /> Approved</> : "Approve course"}</button></div></section>
      </div>
      <section className="proto-panel"><div className="proto-section-title"><div><span>Platform overview</span><h2>User distribution and activity</h2></div><select aria-label="Report period"><option>This month</option></select></div><div className="proto-admin-grid"><div className="proto-donut"><div><strong>85%</strong><span>students</span></div></div><div className="proto-admin-legend"><p><i className="student" /> Students <strong>10,920</strong></p><p><i className="tutor" /> Tutors <strong>286</strong></p><p><i className="admin" /> Admins <strong>8</strong></p></div><div className="proto-activity"><strong>34,218</strong><span>learning sessions</span><em>↑ 12.6% vs last month</em></div></div></section>
    </>
  );
}

function DocumentedFlows({ role, notify }) {
  const [demo, setDemo] = useState(null);
  const [published, setPublished] = useState(false);
  const [restored, setRestored] = useState(false);
  const items = role === "student"
    ? [{ id: "enroll", title: "Course enrollment", caption: "Search, review and enroll" }, { id: "summary", title: "AI summary", caption: "Upload, generate, copy and save" }, { id: "chatbot", title: "AI chatbot", caption: "Ask course-aware questions" }]
    : role === "tutor"
      ? [{ id: "create", title: "Create course", caption: "Set details and publish" }, { id: "upload", title: "Upload materials", caption: "PDF, DOCX, PPT and video" }, { id: "progress", title: "Track students", caption: "Lessons, scores and support" }]
      : [{ id: "users", title: "Manage users", caption: "Search, ban and restore" }, { id: "roles", title: "Assign roles", caption: "Verify registered emails" }, { id: "reports", title: "System reports", caption: "Monitor platform health" }];
  return <>
    <section className="proto-usecases"><div><span>PDF requirements</span><h2>Interactive use-case demos</h2></div>{items.map(item => <button key={item.id} onClick={() => setDemo(item.id)}><strong>{item.title}</strong><small>{item.caption}</small><FaArrowRight /></button>)}</section>
    {demo === "create" && <Modal title="Create & manage a course" icon={<FaPlus />} onClose={() => setDemo(null)}><div className="proto-demo-stack"><label>Course title<input defaultValue="Generative AI Fundamentals" /></label><label>Description<textarea defaultValue="Learn prompt design, responsible AI, and practical workflows." /></label><div className="proto-split"><label>Category<select defaultValue="AI"><option>AI</option><option>Programming</option><option>Design</option></select></label><label>Difficulty<select defaultValue="Intermediate"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></div><button className="proto-primary" onClick={() => {setPublished(true);notify("Course published for Admin approval");}}>{published ? <><FaCheckCircle /> Published</> : "Publish course"}</button></div></Modal>}
    {demo === "upload" && <Modal title="Upload learning materials" icon={<FaUpload />} onClose={() => setDemo(null)}><div className="proto-demo-stack"><div className="proto-dropzone"><FaUpload /><strong>Drop files or browse</strong><span>PDF, DOCX, PPT and MP4</span><button onClick={() => notify("Demo files selected")}>Browse files</button></div>{[[<FaFilePdf />,"Lesson_1_Intro.pdf","1.2 MB"],[<FaVideo />,"Lesson_2_Video.mp4","45 MB"],[<FaFileAlt />,"Lesson_3_Notes.docx","890 KB"]].map(file => <div className="proto-file" key={file[1]}>{file[0]}<span><strong>{file[1]}</strong><small>{file[2]} · Ready</small></span><FaCheckCircle /></div>)}<button className="proto-primary" onClick={() => notify("Materials saved and published")}>Save materials</button></div></Modal>}
    {demo === "progress" && <Modal title="Student progress · Python Basics" icon={<FaChartLine />} onClose={() => setDemo(null)}><div className="proto-progress-table"><div><b>Student</b><b>Lessons</b><b>Score</b><b>Status</b></div>{[["Lwin","8 / 10","91%","On track"],["Kaido","5 / 10","74%","Behind"],["Aung","10 / 10","95%","Completed"],["Sompee","3 / 10","61%","Behind"]].map(row => <div key={row[0]}>{row.map(cell => <span key={cell}>{cell}</span>)}</div>)}</div></Modal>}
    {demo === "users" && <Modal title="Admin user management" icon={<FaUsers />} onClose={() => setDemo(null)}><div className="proto-demo-stack"><div className="proto-user-filter"><FaSearch /><input placeholder="Search by name or email" /><select><option>All roles</option><option>Students</option><option>Tutors</option></select></div>{[["Alice Johnson","alice@mail.com","Student","Active"],["Prof. Smith","smith@mail.com","Tutor","Active"],["Bob Lee","bob@mail.com","Student",restored?"Active":"Suspended"],["Dr. Carol","carol@mail.com","Tutor","Active"]].map(user => <div className="proto-admin-user" key={user[0]}><div><strong>{user[0]}</strong><small>{user[1]}</small></div><span>{user[2]}</span><em>{user[3]}</em><button onClick={() => user[0] === "Bob Lee" ? setRestored(!restored) : notify(`${user[0]} suspended`)}>{user[3] === "Suspended" ? <><FaCheckCircle /> Restore</> : <><FaBan /> Ban</>}</button></div>)}</div></Modal>}
    {demo && !["create","upload","progress","users"].includes(demo) && <Modal title={items.find(item => item.id === demo)?.title || "Workflow demo"} icon={<FaCheckCircle />} onClose={() => setDemo(null)}><div className="proto-flow-confirm"><FaCheckCircle /><h3>This workflow is demonstrated on the current dashboard.</h3><p>Use the highlighted actions and role navigation to present each step with realistic demo data.</p></div></Modal>}
  </>;
}

function Metric({ icon, value, label }) { return <div className="proto-metric"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>; }

function CourseCard({ course, action, onAction }) { return <article className="proto-course-card"><div className={`proto-course-cover ${course.tone}`}><span>{course.level}</span><FaBookOpen /></div><div className="proto-course-body"><h3>{course.title}</h3><p>{course.tutor}</p><div className="proto-course-meta"><span><FaStar /> {course.rating}</span><span><FaUsers /> {course.students}</span></div>{course.progress > 0 && <div className="proto-progress"><span style={{ width: `${course.progress}%` }} /><small>{course.progress}%</small></div>}<button onClick={onAction}>{action} <FaArrowRight /></button></div></article>; }

function Modal({ title, icon, children, onClose }) { return <div className="proto-modal-backdrop" onMouseDown={onClose}><div className="proto-modal" onMouseDown={e => e.stopPropagation()}><div className="proto-modal-head"><span>{icon}</span><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>; }

function Prototype() {
  const [role, setRole] = useState(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [toast, setToast] = useState("");
  const person = role ? roles[role] : null;
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const view = role === "student"
    ? <StudentView notify={notify} />
    : role === "tutor"
      ? <TutorView notify={notify} />
      : <AdminView notify={notify} />;

  if (!role) return <RoleGate onEnter={(nextRole) => { setRole(nextRole); setActiveNav("Overview"); }} />;

  return (
    <div className={`proto-app role-${role}`}>
      <aside className="proto-sidebar">
        <Link to="/" className="proto-brand"><span><FaGraduationCap /></span>EDUNOVA</Link>
        <div className="proto-role-chip"><span>{person.initials}</span><div><strong>{person.name}</strong><small>{person.label} account</small></div></div>
        <nav>{person.nav.map((item, i) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => { setActiveNav(item); notify(`${item} selected in the ${person.label} workflow`); }}>{[<FaChartLine />, <FaBookOpen />, <FaRobot />, <FaCrown />, <FaComments />][i]}<span>{item}</span>{activeNav === item && <i />}</button>)}</nav>
        <div className="proto-side-note"><FaMagic /><strong>Prototype mode</strong><p>Explore every role without changing real data.</p></div>
        <button className="proto-switch" onClick={() => setRole(null)}>Switch demo role <FaArrowRight /></button>
      </aside>
      <main className="proto-main">
        <header className="proto-topbar"><div className="proto-search"><FaSearch /><input aria-label="Search prototype" placeholder={`Search ${person.label.toLowerCase()} workspace...`} /></div><div className="proto-top-actions"><span className="proto-system"><i /> All systems operational</span><button onClick={() => notify("No new notifications")}>◉</button><span className="proto-avatar">{person.initials}</span></div></header>
        <div className="proto-page"><Workflow role={role} /><DocumentedFlows role={role} notify={notify} />{view}</div>
      </main>
      {toast && <div className="proto-toast"><FaCheckCircle />{toast}</div>}
    </div>
  );
}

export default Prototype;

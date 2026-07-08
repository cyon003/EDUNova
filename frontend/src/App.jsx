import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home            from "./pages/Home";
import Auth            from "./pages/Auth";
import StudentDashboard from "./pages/StudentDashboard";
import Courses         from "./pages/Courses";

// These pages are empty/not built yet — placeholder so app doesn't crash
const Dashboard    = () => <div style={{ color: "#f5e6c0", padding: 40, fontFamily: "sans-serif" }}>Dashboard coming soon</div>;
const Profile      = () => <div style={{ color: "#f5e6c0", padding: 40, fontFamily: "sans-serif" }}>Profile coming soon</div>;
const AiAssistant  = () => <div style={{ color: "#f5e6c0", padding: 40, fontFamily: "sans-serif" }}>AI Assistant coming soon</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Home />} />
        <Route path="/auth"              element={<Auth />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/courses"           element={<Courses />} />
        <Route path="/dashboard"         element={<Dashboard />} />
        <Route path="/profile"           element={<Profile />} />
        <Route path="/ai"                element={<AiAssistant />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

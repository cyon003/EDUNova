import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home             from "./pages/Home";
import Auth             from "./pages/Auth";
import StudentDashboard from "./pages/StudentDashboard";
import Courses          from "./pages/Courses";
import Profile          from "./pages/Profile";

// Not built yet — safe placeholders
const Dashboard   = () => <div style={{ color: "#f5e6c0", padding: 40, background: "#130e00", minHeight: "100vh", fontFamily: "sans-serif" }}>Dashboard coming soon</div>;
const AiAssistant = () => <div style={{ color: "#f5e6c0", padding: 40, background: "#130e00", minHeight: "100vh", fontFamily: "sans-serif" }}>AI Assistant coming soon</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Home />} />
        <Route path="/auth"              element={<Auth />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/courses"           element={<Courses />} />
        <Route path="/profile"           element={<Profile />} />
        <Route path="/dashboard"         element={<Dashboard />} />
        <Route path="/ai"                element={<AiAssistant />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

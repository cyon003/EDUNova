import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AiChatbot from "./pages/AiChatbot";
import Auth from "./pages/Auth";
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import Ranking from "./pages/Ranking";
import StudentDashboard from "./pages/StudentDashboard";
import PopularCourses from "./pages/PopularCourses";
import UserHome from "./pages/UserHome";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function App() {
  const user = getStoredUser();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <UserHome /> : <Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseSlug" element={<CourseDetail />} />
        <Route path="/popular-courses" element={<PopularCourses />} />
        <Route path="/ai-chatbot" element={<AiChatbot />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

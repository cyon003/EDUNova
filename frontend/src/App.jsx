import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AiChatbot from "./pages/AiChatbot";
import AdminDashboard from "./pages/AdminDashboard";
import Auth from "./pages/Auth";
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import StudentDashboard from "./pages/StudentDashboard";
import TutorDashboard from "./pages/TutorDashboard";
import UserHome from "./pages/UserHome";
import MyCourses from "./pages/MyCourses";
import NavigationManager from "./components/NavigationManager";

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

function getRoleHome(role) {
  if (role === "admin") return "/admin-dashboard";
  if (role === "tutor") return "/tutor-dashboard";
  return "/";
}

function RoleRoute({ user, allowedRoles, children }) {
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return children;
}

function App() {
  const user = getStoredUser();

  return (
    <BrowserRouter>
      <NavigationManager />
      <Routes>
        <Route
          path="/"
          element={
            user && user.role !== "student" ? (
              <Navigate to={getRoleHome(user.role)} replace />
            ) : user ? (
              <UserHome />
            ) : (
              <Home />
            )
          }
        />
        <Route
          path="/auth"
          element={user ? <Navigate to={getRoleHome(user.role)} replace /> : <Auth />}
        />
        <Route
          path="/student-dashboard"
          element={
            <RoleRoute user={user} allowedRoles={["student"]}>
              <StudentDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/my-courses"
          element={
            <RoleRoute user={user} allowedRoles={["student"]}>
              <MyCourses />
            </RoleRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/tutor-dashboard"
          element={
            <RoleRoute user={user} allowedRoles={["tutor"]}>
              <TutorDashboard />
            </RoleRoute>
          }
        />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseSlug" element={<CourseDetail />} />
        <Route path="/popular-courses" element={<Navigate to="/courses#popular" replace />} />
        <Route path="/ai-chatbot" element={<AiChatbot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

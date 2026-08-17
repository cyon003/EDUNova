import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AiChatbot from "./pages/AiChatbot";
import Auth from "./pages/Auth";
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import Ranking from "./pages/Ranking";
import StudentDashboard from "./pages/StudentDashboard";
import TutorDashboard from "./pages/TutorDashboard";
import PopularCourses from "./pages/PopularCourses";
import UserHome from "./pages/UserHome";

import AdminOverview from "./pages/AdminOverview";
import AdminTutors from "./pages/AdminTutors";
import AdminStudents from "./pages/AdminStudents";
import AdminCourses from "./pages/AdminCourses";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";

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
  if (!user) return <Navigate to="/auth" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return children;
}

function App() {
  const user = getStoredUser();

  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
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
          element={
            user ? (
              <Navigate to={getRoleHome(user.role)} replace />
            ) : (
              <Auth />
            )
          }
        />

        {/* Student */}
        <Route
          path="/student-dashboard"
          element={
            <RoleRoute user={user} allowedRoles={["student"]}>
              <StudentDashboard />
            </RoleRoute>
          }
        />

        {/* Tutor */}
        <Route
          path="/tutor-dashboard"
          element={
            <RoleRoute user={user} allowedRoles={["tutor"]}>
              <TutorDashboard />
            </RoleRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin-dashboard"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminOverview />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/tutors"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminTutors />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/students"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminStudents />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/courses"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminCourses />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/reports"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminReports />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/settings"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminSettings />
            </RoleRoute>
          }
        />

        {/* Shared */}
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseSlug" element={<CourseDetail />} />
        <Route path="/popular-courses" element={<PopularCourses />} />
        <Route path="/ai-chatbot" element={<AiChatbot />} />
        <Route path="/ranking" element={<Ranking />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
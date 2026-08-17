import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AiChatbot from "./pages/AiChatbot";
import Auth from "./pages/Auth";
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import StudentDashboard from "./pages/StudentDashboard";
import TutorDashboard from "./pages/TutorDashboard";
import UserHome from "./pages/UserHome";
import MyCourses from "./pages/MyCourses";
import LessonPlayer from "./pages/LessonPlayer";
import NavigationManager from "./components/NavigationManager";

import AdminOverview from "./pages/AdminOverview";
import AdminTutors from "./pages/AdminTutors";
import AdminStudents from "./pages/AdminStudents";
import AdminCourses from "./pages/AdminCourses";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminTutorApplications from "./pages/AdminTutorApplications";
import TutorApplication from "./pages/TutorApplication";

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

function RoleRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/auth" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

function App() {
  const user = getStoredUser();

  return (
    <BrowserRouter>
      <NavigationManager />
      <Routes>

        {/* Public */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/home" replace />
            ) : (
              <Home />
            )
          }
        />

        <Route
          path="/auth"
          element={
            user ? (
              <Navigate to="/home" replace />
            ) : (
              <Auth />
            )
          }
        />

        {/* Student */}
        <Route
          path="/home"
          element={
            <RoleRoute user={user} allowedRoles={["student", "admin", "tutor"]}>
              <UserHome />
            </RoleRoute>
          }
        />
        <Route path="/student-home" element={<Navigate to="/home" replace />} />

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

        {/* Tutor */}
        <Route
          path="/tutor-dashboard"
          element={
            <RoleRoute user={user} allowedRoles={["tutor"]}>
              <TutorDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/tutor-application"
          element={
            <RoleRoute user={user} allowedRoles={["tutor"]}>
              <TutorApplication />
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
          path="/admin-dashboard/tutor-applications"
          element={
            <RoleRoute user={user} allowedRoles={["admin"]}>
              <AdminTutorApplications />
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
        <Route
          path="/courses/:courseSlug/learn/:lessonNumber?"
          element={
            <RoleRoute user={user} allowedRoles={["student"]}>
              <LessonPlayer />
            </RoleRoute>
          }
        />
        <Route path="/popular-courses" element={<Navigate to="/courses#popular" replace />} />
        <Route path="/ai-chatbot" element={<AiChatbot />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;

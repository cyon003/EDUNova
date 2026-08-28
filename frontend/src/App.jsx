import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import NavigationManager from "./components/NavigationManager";
import AdminCourses from "./pages/AdminCourses";
import AdminOverview from "./pages/AdminOverview";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminStudents from "./pages/AdminStudents";
import AdminTutorApplications from "./pages/AdminTutorApplications";
import AdminTutors from "./pages/AdminTutors";
import AiChatbot from "./pages/AiChatbot";
import Auth from "./pages/Auth";
import CartPage from "./pages/CartPage";
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import LessonPlayer from "./pages/LessonPlayer";
import MyCourses from "./pages/MyCourses";
import MyTutorApplications from "./pages/MyTutorApplications";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import StudentDashboard from "./pages/StudentDashboard";
import TutorApplication from "./pages/TutorApplication";
import TutorDashboard from "./pages/TutorDashboard";
import UserHome from "./pages/UserHome";
import { AUTH_EVENT, restoreSession, storedUser } from "./utils/authClient";

function RoleRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/auth" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to={getRoleLanding(user)} replace />;
  return children;
}

function getRoleLanding(user) {
  if (user?.role === "admin") return "/admin-dashboard";
  return "/home";
}

function App() {
  const [auth, setAuth] = useState({ loading: true, user: storedUser() });

  useEffect(() => {
    let active = true;
    const update = (event) => active && setAuth({ loading: false, user: event.detail.user });
    window.addEventListener(AUTH_EVENT, update);
    restoreSession().then((user) => active && setAuth({ loading: false, user }));
    return () => {
      active = false;
      window.removeEventListener(AUTH_EVENT, update);
    };
  }, []);

  if (auth.loading) {
    return <div className="app-session-loading" role="status">Restoring your EDUNova session…</div>;
  }

  const user = auth.user;

  return (
    <BrowserRouter>
      <NavigationManager />
      <Routes>
        <Route path="/" element={user ? <Navigate to={getRoleLanding(user)} replace /> : <Home />} />
        <Route path="/auth" element={user ? <Navigate to={getRoleLanding(user)} replace /> : <Auth />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route path="/home" element={<RoleRoute user={user} allowedRoles={["student", "admin", "tutor"]}><UserHome /></RoleRoute>} />
        <Route path="/student-home" element={<Navigate to="/home" replace />} />
        <Route path="/student-dashboard" element={<RoleRoute user={user} allowedRoles={["student"]}><StudentDashboard /></RoleRoute>} />
        <Route path="/my-courses" element={<RoleRoute user={user} allowedRoles={["student"]}><MyCourses /></RoleRoute>} />
        <Route path="/my-tutor-applications" element={<RoleRoute user={user} allowedRoles={["student", "tutor"]}><MyTutorApplications /></RoleRoute>} />
        <Route path="/profile" element={<RoleRoute user={user} allowedRoles={["student"]}><Profile /></RoleRoute>} />

        <Route path="/tutor-dashboard" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorDashboard /></RoleRoute>} />
        <Route path="/tutor-application" element={<RoleRoute user={user} allowedRoles={["student", "tutor"]}><TutorApplication /></RoleRoute>} />
        <Route path="/tutor-courses/*" element={<Navigate to="/tutor-dashboard" replace />} />
        <Route path="/tutor-students" element={<Navigate to="/tutor-dashboard" replace />} />
        <Route path="/tutor-analytics" element={<Navigate to="/tutor-dashboard" replace />} />

        <Route path="/admin-dashboard" element={<RoleRoute user={user} allowedRoles={["admin"]}><AdminOverview /></RoleRoute>} />
        <Route path="/admin-dashboard/tutors" element={<RoleRoute user={user} allowedRoles={["admin"]}><AdminTutors /></RoleRoute>} />
        <Route path="/admin-dashboard/tutor-applications" element={<RoleRoute user={user} allowedRoles={["admin"]}><AdminTutorApplications /></RoleRoute>} />
        <Route path="/admin-dashboard/students" element={<RoleRoute user={user} allowedRoles={["admin"]}><AdminStudents /></RoleRoute>} />
        <Route path="/admin-dashboard/courses" element={<RoleRoute user={user} allowedRoles={["admin"]}><AdminCourses /></RoleRoute>} />
        <Route path="/admin-dashboard/reports" element={<RoleRoute user={user} allowedRoles={["admin"]}><AdminReports /></RoleRoute>} />
        <Route path="/admin-dashboard/settings" element={<RoleRoute user={user} allowedRoles={["admin"]}><AdminSettings /></RoleRoute>} />

        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseSlug" element={<CourseDetail />} />
        <Route path="/courses/:courseSlug/learn/:lessonNumber?" element={<RoleRoute user={user} allowedRoles={["student"]}><LessonPlayer /></RoleRoute>} />
        <Route path="/cart" element={<RoleRoute user={user} allowedRoles={["student"]}><CartPage /></RoleRoute>} />
        <Route path="/popular-courses" element={<Navigate to="/courses#popular" replace />} />
        <Route path="/ai-tutor" element={<RoleRoute user={user} allowedRoles={["student", "tutor", "admin"]}><AiChatbot /></RoleRoute>} />
        <Route path="/ai-chatbot" element={<Navigate to="/ai-tutor" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

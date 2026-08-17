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
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import LessonPlayer from "./pages/LessonPlayer";
import MyCourses from "./pages/MyCourses";
import StudentDashboard from "./pages/StudentDashboard";
import TutorAnalytics from "./pages/TutorAnalytics";
import TutorApplication from "./pages/TutorApplication";
import TutorAssessments from "./pages/TutorAssessments";
import TutorCommunication from "./pages/TutorCommunication";
import TutorCourseContent from "./pages/TutorCourseContent";
import TutorCourseEditor from "./pages/TutorCourseEditor";
import TutorCourses from "./pages/TutorCourses";
import TutorDashboard from "./pages/TutorDashboard";
import TutorSessions from "./pages/TutorSessions";
import TutorStudents from "./pages/TutorStudents";
import TutorSubmissions from "./pages/TutorSubmissions";
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

function RoleRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/auth" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/home" replace />;
  return children;
}

function App() {
  const user = getStoredUser();

  return (
    <BrowserRouter>
      <NavigationManager />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/home" replace /> : <Home />} />
        <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <Auth />} />

        <Route path="/home" element={<RoleRoute user={user} allowedRoles={["student", "admin", "tutor"]}><UserHome /></RoleRoute>} />
        <Route path="/student-home" element={<Navigate to="/home" replace />} />
        <Route path="/student-dashboard" element={<RoleRoute user={user} allowedRoles={["student"]}><StudentDashboard /></RoleRoute>} />
        <Route path="/my-courses" element={<RoleRoute user={user} allowedRoles={["student"]}><MyCourses /></RoleRoute>} />

        <Route path="/tutor-dashboard" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorDashboard /></RoleRoute>} />
        <Route path="/tutor-application" element={<RoleRoute user={user} allowedRoles={["student", "tutor"]}><TutorApplication /></RoleRoute>} />
        <Route path="/tutor-courses" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorCourses /></RoleRoute>} />
        <Route path="/tutor-courses/new" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorCourseEditor /></RoleRoute>} />
        <Route path="/tutor-courses/:courseId/edit" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorCourseEditor /></RoleRoute>} />
        <Route path="/tutor-courses/:courseId/content" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorCourseContent /></RoleRoute>} />
        <Route path="/tutor-assessments" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorAssessments /></RoleRoute>} />
        <Route path="/tutor-assessments/:assessmentId/submissions" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorSubmissions /></RoleRoute>} />
        <Route path="/tutor-students" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorStudents /></RoleRoute>} />
        <Route path="/tutor-communication" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorCommunication /></RoleRoute>} />
        <Route path="/tutor-sessions" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorSessions /></RoleRoute>} />
        <Route path="/tutor-analytics" element={<RoleRoute user={user} allowedRoles={["tutor"]}><TutorAnalytics /></RoleRoute>} />

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
        <Route path="/popular-courses" element={<Navigate to="/courses#popular" replace />} />
        <Route path="/ai-chatbot" element={<AiChatbot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

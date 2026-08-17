import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import NavigationManager from "./components/NavigationManager";

import AdminDashboard from "./pages/AdminDashboard";
import AiChatbot from "./pages/AiChatbot";
import Auth from "./pages/Auth";
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import MyCourses from "./pages/MyCourses";
import StudentDashboard from "./pages/StudentDashboard";
import TutorAssessments from "./pages/TutorAssessments";
import TutorAnalytics from "./pages/TutorAnalytics";
import TutorCommunication from "./pages/TutorCommunication";
import TutorCourseContent from "./pages/TutorCourseContent";
import TutorCourseEditor from "./pages/TutorCourseEditor";
import TutorCourses from "./pages/TutorCourses";
import TutorDashboard from "./pages/TutorDashboard";
import TutorSessions from "./pages/TutorSessions";
import TutorSubmissions from "./pages/TutorSubmissions";
import TutorStudents from "./pages/TutorStudents";
import UserHome from "./pages/UserHome";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function getRoleHome(role) {
  if (role === "admin") {
    return "/admin-dashboard";
  }

  if (role === "tutor") {
    return "/tutor-dashboard";
  }

  return "/";
}

function RoleRoute({
  user,
  allowedRoles,
  children,
}) {
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={getRoleHome(user.role)}
        replace
      />
    );
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
              <Navigate
                to={getRoleHome(user.role)}
                replace
              />
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
              <Navigate
                to={getRoleHome(user.role)}
                replace
              />
            ) : (
              <Auth />
            )
          }
        />

        <Route
          path="/student-dashboard"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["student"]}
            >
              <StudentDashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/my-courses"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["student"]}
            >
              <MyCourses />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminDashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/tutor-dashboard"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["tutor"]}
            >
              <TutorDashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/tutor-courses"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["tutor"]}
            >
              <TutorCourses />
            </RoleRoute>
          }
        />
        <Route
  path="/tutor-courses/:courseId/content"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorCourseContent />
    </RoleRoute>
  }
/>
        <Route
  path="/tutor-courses/new"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorCourseEditor />
    </RoleRoute>
  }
/>
<Route
  path="/tutor-assessments"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorAssessments />
    </RoleRoute>
  }
/>
<Route
  path="/tutor-assessments/:assessmentId/submissions"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorSubmissions />
    </RoleRoute>
  }
/>

<Route
  path="/tutor-students"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorStudents />
    </RoleRoute>
  }
/>

<Route
  path="/tutor-communication"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorCommunication />
    </RoleRoute>
  }
/>

<Route
  path="/tutor-sessions"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorSessions />
    </RoleRoute>
  }
/>

<Route
  path="/tutor-analytics"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorAnalytics />
    </RoleRoute>
  }
/>



<Route
  path="/tutor-courses/:courseId/edit"
  element={
    <RoleRoute
      user={user}
      allowedRoles={["tutor"]}
    >
      <TutorCourseEditor />
    </RoleRoute>
  }
/>

        <Route
          path="/courses"
          element={<Courses />}
        />

        <Route
          path="/courses/:courseSlug"
          element={<CourseDetail />}
        />

        <Route
          path="/popular-courses"
          element={
            <Navigate
              to="/courses#popular"
              replace
            />
          }
        />

        <Route
          path="/ai-chatbot"
          element={<AiChatbot />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

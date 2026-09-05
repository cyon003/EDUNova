import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import NavigationManager from "./components/NavigationManager";

import AdminCourses from "./pages/AdminCourses";
import AdminOverview from "./pages/AdminOverview";
import AdminPaymentVerification from "./pages/AdminPaymentVerification";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminStudents from "./pages/AdminStudents";
import AdminTutorApplications from "./pages/AdminTutorApplications";
import AdminTutors from "./pages/AdminTutors";

import AiChatbot from "./pages/AiChatbot";
import Auth from "./pages/Auth";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import CourseDetail from "./pages/CourseDetail";
import Courses from "./pages/Courses";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import LessonPlayer from "./pages/LessonPlayer";
import MyCourses from "./pages/MyCourses";
import MyTutorApplications from "./pages/MyTutorApplications";
import OrderSuccess from "./pages/OrderSuccess";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import StudentDashboard from "./pages/StudentDashboard";
import TutorApplication from "./pages/TutorApplication";
import TutorDashboard from "./pages/TutorDashboard";
import UserHome from "./pages/UserHome";

import {
  AUTH_EVENT,
  restoreSession,
  storedUser,
} from "./utils/authClient";

function RoleRoute({ user, allowedRoles, children }) {
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={getRoleLanding(user)}
        replace
      />
    );
  }

  return children;
}

function getRoleLanding(user) {
  if (user?.role === "admin") {
    return "/admin-dashboard";
  }

  return "/home";
}

function App() {
  const [auth, setAuth] = useState({
    loading: true,
    user: storedUser(),
  });

  useEffect(() => {
    let active = true;

    const update = (event) => {
      if (!active) return;

      setAuth({
        loading: false,
        user: event.detail.user,
      });
    };

    window.addEventListener(AUTH_EVENT, update);

    restoreSession().then((user) => {
      if (!active) return;

      setAuth({
        loading: false,
        user,
      });
    });

    return () => {
      active = false;
      window.removeEventListener(AUTH_EVENT, update);
    };
  }, []);

  if (auth.loading) {
    return (
      <div
        className="app-session-loading"
        role="status"
      >
        Restoring your EDUNova session…
      </div>
    );
  }

  const user = auth.user;

  return (
    <BrowserRouter>
      <NavigationManager />

      <Routes>
        {/* =========================
            GENERAL / AUTH
        ========================= */}

        <Route
          path="/"
          element={
            user ? (
              <Navigate
                to={getRoleLanding(user)}
                replace
              />
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
                to={getRoleLanding(user)}
                replace
              />
            ) : (
              <Auth />
            )
          }
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password/:token"
          element={<ResetPassword />}
        />

        {/* =========================
            STUDENT / USER
        ========================= */}

        <Route
          path="/home"
          element={
            <RoleRoute
              user={user}
              allowedRoles={[
                "student",
                "admin",
                "tutor",
              ]}
            >
              <UserHome />
            </RoleRoute>
          }
        />

        <Route
          path="/student-home"
          element={
            <Navigate
              to="/home"
              replace
            />
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
          path="/my-tutor-applications"
          element={
            <RoleRoute
              user={user}
              allowedRoles={[
                "student",
                "tutor",
              ]}
            >
              <MyTutorApplications />
            </RoleRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["student"]}
            >
              <Profile />
            </RoleRoute>
          }
        />

        {/* =========================
            TUTOR
        ========================= */}

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
          path="/tutor-application"
          element={
            <RoleRoute
              user={user}
              allowedRoles={[
                "student",
                "tutor",
              ]}
            >
              <TutorApplication />
            </RoleRoute>
          }
        />

        <Route
          path="/tutor-courses/*"
          element={
            <Navigate
              to="/tutor-dashboard"
              replace
            />
          }
        />

        <Route
          path="/tutor-students"
          element={
            <Navigate
              to="/tutor-dashboard"
              replace
            />
          }
        />

        <Route
          path="/tutor-analytics"
          element={
            <Navigate
              to="/tutor-dashboard"
              replace
            />
          }
        />

        {/* =========================
            ADMIN
        ========================= */}

        <Route
          path="/admin-dashboard"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminOverview />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/tutors"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminTutors />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/tutor-applications"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminTutorApplications />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/students"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminStudents />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/courses"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminCourses />
            </RoleRoute>
          }
        />

        {/* PAYMENT VERIFICATION */}
        <Route
          path="/admin-dashboard/payment-verification"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminPaymentVerification />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/reports"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminReports />
            </RoleRoute>
          }
        />

        <Route
          path="/admin-dashboard/settings"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["admin"]}
            >
              <AdminSettings />
            </RoleRoute>
          }
        />

        {/* =========================
            COURSES
        ========================= */}

        <Route
          path="/courses"
          element={<Courses />}
        />

        <Route
          path="/courses/:courseSlug"
          element={<CourseDetail />}
        />

        <Route
          path="/courses/:courseSlug/learn/:lessonNumber?"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["student"]}
            >
              <LessonPlayer />
            </RoleRoute>
          }
        />

        {/* =========================
            CART / PAYMENT
        ========================= */}

        <Route
          path="/cart"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["student"]}
            >
              <CartPage />
            </RoleRoute>
          }
        />

        <Route
          path="/checkout"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["student"]}
            >
              <CheckoutPage />
            </RoleRoute>
          }
        />

        <Route
          path="/order-success"
          element={
            <RoleRoute
              user={user}
              allowedRoles={["student"]}
            >
              <OrderSuccess />
            </RoleRoute>
          }
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

        {/* =========================
            AI
        ========================= */}

        <Route
          path="/ai-tutor"
          element={
            <RoleRoute
              user={user}
              allowedRoles={[
                "student",
                "tutor",
                "admin",
              ]}
            >
              <AiChatbot />
            </RoleRoute>
          }
        />

        <Route
          path="/ai-chatbot"
          element={
            <Navigate
              to="/ai-tutor"
              replace
            />
          }
        />

        {/* =========================
            FALLBACK
        ========================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
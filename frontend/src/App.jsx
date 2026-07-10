// import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
// import Auth from "./pages/Auth";
// import Courses from "./pages/Courses";
// import Home from "./pages/Home";
// import StudentDashboard from "./pages/StudentDashboard";
// import UserHome from "./pages/UserHome";

// function getStoredUser() {
//   try {
//     const raw = localStorage.getItem("user");
//     if (!raw) return null;

//     const parsed = JSON.parse(raw);
//     return parsed && typeof parsed === "object" ? parsed : null;
//   } catch {
//     return null;
//   }
// }

// function App() {
//   const user = getStoredUser();

//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={user ? <UserHome /> : <Home />} />
//         <Route path="/auth" element={<Auth />} />
//         <Route path="/student-dashboard" element={<StudentDashboard />} />
//         <Route path="/courses" element={<Courses />} />
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;


// frontend/src/App.jsx

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Auth from "./pages/Auth";
import Courses from "./pages/Courses";
import Home from "./pages/Home";
import StudentDashboard from "./pages/StudentDashboard";
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
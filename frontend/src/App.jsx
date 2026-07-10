import { BrowserRouter, Route, Routes } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import StudentDashboard from "./pages/StudentDashboard";
import UserHome from "./pages/UserHome";
// import Courses from "./pages/Courses";

// Safely reads the stored user. Returns null instead of throwing if the
// value is missing or corrupted (e.g. the literal string "undefined").
function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
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
        {/* <Route path="/courses" element={<Courses />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// import { BrowserRouter, Route, Routes } from "react-router-dom";
// import Auth from "./pages/Auth";
// import Home from "./pages/Home";
// import StudentDashboard from "./pages/StudentDashboard";
// import UserHome from "./pages/UserHome";
// import Courses from "./pages/Courses";

// function getStoredUser() {
//   try {
//     const raw = localStorage.getItem("user");
//     if (!raw) return null;
//     const parsed = JSON.parse(raw);
//     if (!parsed || typeof parsed !== "object") return null;
//     return parsed;
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
//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { allowedOrigins } = require("./config/environment");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const courseRoutes = require("./routes/courseRoutes");
const messageRoutes = require("./routes/messageRoutes");
const searchRoutes = require("./routes/searchRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const noteRoutes = require("./routes/noteRoutes");
const reportRoutes = require("./routes/reportRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const tutorApplicationRoutes = require("./routes/tutorApplicationRoutes");
const tutorRoutes = require("./routes/tutorRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const profileRoutes = require("./routes/profileRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const aiRoutes = require("./routes/aiRoutes");
const learningSignalRoutes = require("./routes/learningSignalRoutes");

const app = express();
const configuredOrigins = allowedOrigins();

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, "");
    if (configuredOrigins.has(normalizedOrigin)) return callback(null, true);
    return callback(Object.assign(new Error("Origin is not allowed by CORS"), { status: 403 }));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Application-Token"],
}));
app.use(express.json({ limit: "1mb" }));
// Lesson media and resources are served only by authenticated course routes.
app.use("/uploads/course-covers", express.static(path.join(__dirname, "uploads", "course-covers")));
app.use("/uploads/profile-photos", express.static(path.join(__dirname, "uploads", "profile-photos")));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/tutor-application", tutorApplicationRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/learning-signals", learningSignalRoutes);

app.get("/", (_req, res) => res.send("EduNova backend is running"));
app.get("/api/health", (_req, res) => res.json({ status: "ok", environment: process.env.NODE_ENV || "development" }));

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));

app.use((error, _req, res, _next) => {
  const status = Number(error.status || error.statusCode) || 500;
  if (status >= 500) console.error("Unhandled request error:", error);
  return res.status(status).json({
    message: status >= 500 ? "Internal server error" : error.message,
    ...(process.env.NODE_ENV === "development" && status >= 500 ? { error: error.message } : {}),
  });
});

module.exports = app;

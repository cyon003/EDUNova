const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { allowedOrigins } = require("../config/environment");

function userRoom(userId) {
  return `user:${String(userId)}`;
}

async function authenticatedUser(token) {
  if (!token) throw new Error("Authentication required");
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-password");

  if (!user) throw new Error("User account not found");
  if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
    throw new Error("Your session is no longer valid. Please log in again.");
  }
  if (user.passwordChangedAt && decoded.iat) {
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (changedAtSeconds > decoded.iat) throw new Error("Password changed. Please log in again.");
  }
  if (user.accountStatus !== "approved") throw new Error("Your account has been suspended");
  if (!["student", "tutor"].includes(user.role)) throw new Error("Messaging is available only to students and tutors");
  return user;
}

function socketOriginAllowed(origin, callback) {
  if (!origin) return callback(null, true);
  const origins = allowedOrigins();
  if (origins.has(origin.replace(/\/$/, ""))) return callback(null, true);
  return callback(new Error("Origin is not allowed by CORS"));
}

function attachMessageSocket(httpServer, app) {
  const io = new Server(httpServer, {
    cors: {
      origin: socketOriginAllowed,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const authorization = socket.handshake.headers.authorization || "";
      const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      const token = socket.handshake.auth?.token || bearerToken;
      socket.user = await authenticatedUser(token);
      next();
    } catch (error) {
      const authError = new Error("Authentication failed");
      authError.data = { message: error.message };
      next(authError);
    }
  });

  io.on("connection", (socket) => {
    // The room is derived exclusively from the verified token. Clients cannot select it.
    socket.join(userRoom(socket.user._id));
  });

  app.set("messageIo", io);
  return io;
}

module.exports = { attachMessageSocket, authenticatedUser, userRoom };

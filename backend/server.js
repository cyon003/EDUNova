const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = require("./app");
const { validateEnvironment } = require("./config/environment");
const TutorApplication = require("./models/TutorApplication");
const RefreshSession = require("./models/RefreshSession");
const LearningSignal = require("./models/LearningSignal");

async function startServer() {
  const { port } = validateEnvironment();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([TutorApplication.syncIndexes(), RefreshSession.syncIndexes(), LearningSignal.syncIndexes()]);
  console.log("MongoDB Connected");

  const server = app.listen(port, () => console.log(`Server running on port ${port}`));
  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down safely.`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Unable to start server:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { startServer };

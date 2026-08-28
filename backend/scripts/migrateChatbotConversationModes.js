const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function migrate() {
  if (!String(process.env.MONGO_URI || "").trim()) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  const conversations = mongoose.connection.collection("chatbotconversations");
  const result = await conversations.updateMany(
    { mode: { $exists: false } },
    { $set: { mode: "course" } }
  );
  console.log(`Marked ${result.modifiedCount} existing assistant conversation(s) as course mode.`);
  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error("Conversation mode migration failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});

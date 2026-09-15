const mongoose = require("mongoose");

// Deterministic _id uses MongoDB's built-in unique index, including on first use.
const schema = new mongoose.Schema({
  _id: String,
  used: { type: Number, default: 0 },
  pending: [{ _id: false, token: String, expiresAt: Date }],
});
module.exports = mongoose.model("AiUsage", schema);

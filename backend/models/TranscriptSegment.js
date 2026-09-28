const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  jobId: mongoose.Schema.Types.ObjectId,
  resultToken: String,
  index: Number,
  startTimeSeconds: Number,
  endTimeSeconds: Number,
  text: String,
}, { collection: "transcript_segments" });
schema.index({ jobId: 1, resultToken: 1, index: 1 }, { unique: true });
module.exports = mongoose.model("TranscriptSegment", schema);

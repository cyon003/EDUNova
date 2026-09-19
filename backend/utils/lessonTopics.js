const mongoose = require("mongoose");
const MAX_TOPIC_TITLE = 200;
const MAX_TOPICS = 200;

function topicRangesError(topics) {
  if (!Array.isArray(topics) || topics.length > MAX_TOPICS) return `Topics must be an array of at most ${MAX_TOPICS} items`;
  let previousEnd = 0;
  const ids = new Set();
  for (const topic of topics) {
    if (!topic || typeof topic.title !== "string" || !topic.title.trim() || topic.title.trim().length > MAX_TOPIC_TITLE) return "Each topic requires a title of 1 to 200 characters";
    if (!Number.isFinite(topic.startTimeSeconds) || !Number.isFinite(topic.endTimeSeconds) || topic.startTimeSeconds < 0 || topic.endTimeSeconds <= topic.startTimeSeconds) return "Topic ranges require finite timestamps with end greater than start and start at least zero";
    if (topic.startTimeSeconds < previousEnd) return "Topics must be ordered by start time and must not overlap";
    previousEnd = topic.endTimeSeconds;
    if (topic._id != null) {
      if (!mongoose.isObjectIdOrHexString(topic._id) || ids.has(String(topic._id))) return "Topic IDs must be valid and unique";
      ids.add(String(topic._id));
    }
  }
  return null;
}

function topicFields(body, existingTopics = [], durationSeconds = null) {
  if (!Object.hasOwn(body, "topics")) return { values: {} };
  let topics = body.topics;
  if (typeof topics === "string") {
    try { topics = JSON.parse(topics); } catch { return { error: "Topics must be a JSON array" }; }
  }
  const error = topicRangesError(topics);
  if (error) return { error };
  const existingIds = new Set(existingTopics.map(topic => String(topic._id)));
  for (const topic of topics) {
    if (Object.keys(topic).some(key => !["_id", "title", "startTimeSeconds", "endTimeSeconds"].includes(key))) return { error: "Unsupported topic field" };
    if (topic._id != null && !existingIds.has(String(topic._id))) return { error: "Topic ID does not belong to this lesson" };
    if (Number.isFinite(durationSeconds) && durationSeconds > 0 && topic.endTimeSeconds > durationSeconds) return { error: "Topic end exceeds lesson duration" };
  }
  return { values: { topics: topics.map(topic => ({ ...(topic._id != null ? { _id: topic._id } : {}), title: topic.title.trim(), startTimeSeconds: topic.startTimeSeconds, endTimeSeconds: topic.endTimeSeconds })) } };
}

function topicAtTimestamp(lesson, timestamp) {
  if (!Number.isFinite(timestamp) || timestamp < 0) return null;
  const topics = lesson.topics || [];
  return topics.find((topic, index) => timestamp >= topic.startTimeSeconds &&
    (timestamp < topic.endTimeSeconds || (index === topics.length - 1 && timestamp === topic.endTimeSeconds))) || null;
}
module.exports = { MAX_TOPIC_TITLE, topicRangesError, topicFields, topicAtTimestamp };

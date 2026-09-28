import { formatTopicTime } from "../utils/topicTime.js";

// Uses the existing player's seek handlers; never awards coverage or completion.
export default function LessonTopics({ topics = [], mediaRef, ready }) {
  if (!topics.length) return null;
  return <section className="lesson-materials lesson-student-topics" aria-label="Lesson topics">
    <h2>Lesson topics</h2>
    <p>Choose a topic to revisit. Watch the lesson before skipping ahead.</p>
    <ol>{topics.map(topic => <li key={topic._id}>
      <button type="button" disabled={!ready} onClick={() => {
        const media = mediaRef.current;
        if (!media || media.readyState < 1 || !Number.isFinite(topic.startTimeSeconds)) return;
        media.currentTime = topic.startTimeSeconds;
        media.focus();
      }}><strong>{topic.title}</strong><span>{formatTopicTime(topic.startTimeSeconds)}–{formatTopicTime(topic.endTimeSeconds)}</span></button>
    </li>)}</ol>
  </section>;
}

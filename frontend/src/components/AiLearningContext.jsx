import { videoPositionLabel } from "../utils/aiLearningContext.js";

export default function AiLearningContext({ context }) {
  return <section className="assistant-learning-context" aria-label="Learning context" role="status">
    <h2>Learning context</h2>
    {context ? <><strong>{context.courseTitle}</strong><p>Lesson: {context.lessonTitle}</p>
      {context.topicTitle && <p>Topic: {context.topicTitle}</p>}
      <p>Around {videoPositionLabel(context.videoTimestampSeconds)}</p></> : <p>Lesson context attached</p>}
  </section>;
}

export default function ConfusionRecommendation({ onDismiss, onAskAI }) {
  return <section className="lesson-confusion-recommendation" aria-labelledby="confusion-recommendation-title">
    <div role="status" aria-live="polite">
      <h2 id="confusion-recommendation-title">Having trouble with this part?</h2>
      <p>Your learning pattern suggests this section may be worth reviewing.</p>
    </div>
    <div className="lesson-confusion-actions">
      <button type="button" onClick={onDismiss}>Dismiss</button>
      <button type="button" className="lesson-confusion-ask" onClick={onAskAI}>Ask AI</button>
    </div>
  </section>;
}

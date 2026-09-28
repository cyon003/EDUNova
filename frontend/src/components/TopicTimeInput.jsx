import { formatTopicTime, parseTopicTime } from "../utils/topicTime.js";

export default function TopicTimeInput({ label, value, onChange, disabled = false }) {
  return <label>{label}<span className="lesson-topic-time-input"><input type="text" inputMode="decimal" required disabled={disabled} pattern="[0-9]+:[0-5][0-9]([.][0-9]{1,3})?" placeholder="00:00" aria-label={`${label} (MM:SS)`} value={formatTopicTime(value)} onChange={event => onChange(event.target.value)} onBlur={event => { if (typeof value === "number") return; const seconds = parseTopicTime(event.target.value); if (seconds !== null) onChange(seconds); }} /><small>MM:SS</small></span></label>;
}

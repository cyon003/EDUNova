import { Link } from "react-router-dom";
import "../styles/Subscription.css";

export default function SubscriptionSummary({ subscription, error, onRetry }) {
  if (!subscription) return <section className="subscription-summary" aria-live="polite"><p>{error || "Loading your plan…"}</p>{error && onRetry && <button onClick={onRetry}>Retry</button>}</section>;
  const { plan, aiUsage: usage, endDate, billingCycle } = subscription;
  if (usage.exempt) return <section className="subscription-summary"><strong>Staff AI access</strong><p>Your existing Tutor/Admin access is included.</p></section>;
  return <section className="subscription-summary" aria-label="My plan">
    <strong>EDUNova {plan === "premium" ? <span className="premium-badge">Premium</span> : "Free"}</strong>
    {plan === "premium" && <p>{billingCycle === "yearly" ? "฿999 / year" : "฿99 / month"}</p>}
    <p>AI usage: {usage.used} / {usage.limit} {usage.period === "daily" ? "messages today" : "messages this month"}</p>
    <progress value={usage.used} max={usage.limit} aria-label="AI messages used" />
    {usage.pending > 0 && <p>{usage.pending} request(s) in progress</p>}
    <p>Allowance resets {new Date(usage.resetAt).toLocaleString()}</p>
    {plan === "premium" && endDate && <p>Expires {new Date(endDate).toLocaleDateString()}</p>}
    {usage.remaining === 0 && usage.used < usage.limit && <p role="status">Your remaining allowance is reserved by requests in progress. Usage will refresh shortly.</p>}
    {usage.used >= usage.limit && <p role="status">{usage.period === "daily" ? "You've used your free AI allowance for today. You can upgrade to Premium for more AI access." : "Your monthly AI allowance is currently exhausted."} Your allowance resets on {new Date(usage.resetAt).toLocaleString()}.</p>}
    {error && <p role="alert">{error}</p>}
    <Link className="subscription-button" to="/subscription">{plan === "premium" ? "Manage Subscription" : "Upgrade to Premium"}</Link>
  </section>;
}

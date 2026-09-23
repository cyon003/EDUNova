import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription, subscriptionRequest } from "../hooks/useSubscription";
import SubscriptionSummary from "../components/SubscriptionSummary";
import "../styles/Profile.css";
import "../styles/Subscription.css";

export default function Subscription() {
  const navigate = useNavigate();
  const { subscription, error, refresh } = useSubscription();
  const [cycle, setCycle] = useState("monthly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const premium = subscription?.plan === "premium";
  const upgrade = async () => {
    setBusy(true); setMessage("");
    try {
      const data = await subscriptionRequest("/upgrade", { billingCycle: cycle });
      navigate(`/checkout?orderId=${encodeURIComponent(data.order._id)}&from=subscription`);
    }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <main className="student-profile-page"><div className="student-profile-container subscription-page">
    <Link className="student-profile-back" to="/home">← Back to home</Link>
    <header><span className="student-profile-eyebrow">EDUNOVA PLANS</span><h1>Choose Your Plan</h1><p>Keep learning your way. Get more AI support when you need it.</p></header>
    <SubscriptionSummary subscription={subscription} error={error} onRetry={refresh} />
    {subscription?.pendingPayment && <section className="subscription-summary" role="status"><p>You have a Premium checkout awaiting payment.</p><Link className="subscription-button" to={`/checkout?orderId=${encodeURIComponent(subscription.pendingPayment._id)}&from=subscription`}>View Premium payment</Link></section>}
    {!subscription?.aiUsage.exempt && <>
      <div className="subscription-cycle" aria-label="Billing cycle"><button aria-pressed={cycle === "monthly"} onClick={() => setCycle("monthly")}>Monthly · ฿99</button><button aria-pressed={cycle === "yearly"} onClick={() => setCycle("yearly")}>Yearly · ฿999</button></div>
      <div className="subscription-plans">
        <section className="student-profile-panel"><h2>Free</h2><p className="subscription-price">฿0</p><ul><li>Browse and enroll in courses</li><li>Watch your lessons</li><li>Confusion detection</li><li>5 AI chatbot messages per day</li></ul><button className="subscription-button" disabled>{premium ? "Included with Premium" : "Current Plan"}</button></section>
        <section className="student-profile-panel subscription-premium"><span className="premium-badge">More AI support</span><h2>Premium</h2><p className="subscription-price">{cycle === "yearly" ? "฿999" : "฿99"}<small> / {cycle === "yearly" ? "year" : "month"}</small></p><ul><li>Everything in Free</li><li>500 AI chatbot messages per month</li><li>Confusion detection</li><li>Premium status badge</li></ul><button className="subscription-button" disabled={busy || !subscription || Boolean(subscription.pendingPayment)} onClick={upgrade}>{premium ? "Extend Premium" : "Upgrade to Premium"}</button></section>
      </div>
      <p className="subscription-note">Pay securely with Stripe. Premium activates only after confirmed payment. Premium expires automatically at the end of the paid period. There is no automatic renewal. Course prices and enrollment rules still apply. AI allowances reset at midnight UTC daily or on the first day of each month.</p>
    </>}
    {message && <p className="student-profile-message success" role="status">{message}</p>}
  </div></main>;
}

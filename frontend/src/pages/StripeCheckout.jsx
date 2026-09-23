import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_ROOT, formatCoursePrice } from "../utils/courseApi";
import "../styles/CheckoutPage.css";

export default function StripeCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const orderId = query.get("orderId");
  const sessionId = query.get("session_id");
  const payment = query.get("payment");
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(""); setOrder(null);
      try {
        let data;
        if (sessionId && payment === "success") {
          try {
            data = (await checkoutRequest("/stripe/verify-session", { sessionId })).order;
          } catch (failure) {
            if (!cancelled) setError(failure.message);
          }
        }
        if (!data) data = orderId
          ? await checkoutRequest(`/orders/${encodeURIComponent(orderId)}`)
          : (await checkoutRequest("/orders/checkout", {})).order;
        if (cancelled) return;
        setOrder(data);
        if (!orderId) navigate(`/checkout?orderId=${encodeURIComponent(data._id)}&from=cart`, { replace: true });
      } catch (failure) { if (!cancelled) setError(failure.message); }
    }
    load();
    return () => { cancelled = true; };
  }, [orderId, sessionId, payment, navigate, refresh]);

  async function pay() {
    setBusy(true); setError("");
    try {
      const data = await checkoutRequest("/stripe/create-checkout-session", { orderId: order._id });
      window.location.assign(data.checkoutUrl);
    } catch (failure) { setError(failure.message); setBusy(false); }
  }
  async function verify() {
    setBusy(true); setError("");
    try {
      const data = await checkoutRequest("/stripe/verify-session", { sessionId: order.paymentReference });
      setOrder(data.order);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const premium = order?.paymentType === "subscription";
  const completed = order?.status === "completed";
  const legacy = order && !["stripe", "free"].includes(order.paymentMethod);
  return <main className="checkout-page">
    <header className="checkout-header"><button className="checkout-back" onClick={() => navigate(premium ? "/subscription" : "/cart")}>← Back</button><span>EDUNOVA / CHECKOUT</span></header>
    <div className="checkout-intro"><h1>{completed ? "Purchase complete" : "Secure checkout"}</h1><p>{premium ? "Premium is a one-time purchase. There is no automatic renewal." : "Course access begins after confirmed payment. Free courses need no payment."}</p></div>
    {error && <p className="checkout-error" role="alert">{error}</p>}
    {!order ? <section className="checkout-card"><p>{error ? "Unable to load checkout." : "Loading your order…"}</p><button onClick={() => setRefresh(value => value + 1)}>Retry</button></section> : <div className="checkout-layout">
      <section className="checkout-card">
        {completed ? <><h2>{premium ? "Your Premium time has been activated or extended." : "Your courses are ready."}</h2><button className="checkout-btn-primary" onClick={() => navigate(premium ? "/subscription" : "/my-courses")}>{premium ? "View subscription" : "Go to my learning"}</button></> : legacy ? <><h2>Historical payment record</h2><p>This payment is read-only. Contact support to reconcile any previous transfer before starting a new purchase.</p></> : <>
          {payment === "cancelled" && <p role="status">Checkout was canceled. Your order remains unpaid until Stripe confirms payment.</p>}
          {order.stripeFailedSession === order.paymentReference && order.paymentReference && <p role="alert">Payment failed. You can try again.</p>}
          <p>Pay securely with Stripe using the available payment methods. Pending or failed payments do not activate access.</p>
          {order.status === "pending" && <button className="checkout-btn-primary" disabled={busy} onClick={pay}>{busy ? "Please wait…" : payment === "cancelled" ? "Try payment again" : "Continue to Stripe"}</button>}
          {order.paymentReference && <button className="checkout-back" disabled={busy} onClick={verify}>Check payment status</button>}
        </>}
      </section>
      <aside className="checkout-summary"><h2>Your order</h2>
        {premium ? <p>EDUNova Premium · {order.billingCycle === "yearly" ? "Yearly" : "Monthly"}</p> : order.items?.map((item, index) => <p key={item._id || index}>{item.name || item.course?.name || "Course unavailable"} — {formatCoursePrice(item.price)}</p>)}
        <div className="checkout-summary-total"><span>Total</span><strong>{order.totalAmount === 0 ? "Free" : formatCoursePrice(order.totalAmount)}</strong></div>
        <dl className="checkout-order-meta"><div><dt>Reference</dt><dd>{order.orderReference}</dd></div><div><dt>Status</dt><dd>{order.status}</dd></div></dl>
      </aside>
    </div>}
  </main>;
}

async function checkoutRequest(path, body) {
  const response = await fetch(`${API_ROOT}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to process checkout. Please try again.");
  return data;
}

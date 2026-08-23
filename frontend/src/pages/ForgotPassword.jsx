import { useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowLeft, FaEnvelope } from "react-icons/fa";
import "../styles/PasswordRecovery.css";
import { API_ROOT } from "../utils/courseApi";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${API_ROOT}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      setMessage(data.message || "If an account exists for that email, a password reset link has been sent.");
    } catch {
      setMessage("Unable to contact the server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="password-recovery-page">
      <section className="password-recovery-card">
        <span className="password-recovery-icon"><FaEnvelope /></span>
        <small>ACCOUNT RECOVERY</small>
        <h1>Forgot your password?</h1>
        <p>Enter your account email. If an account exists, we will send a secure reset link.</p>
        <form onSubmit={submit}>
          <label htmlFor="recovery-email">Email address</label>
          <input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
          <button type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
        </form>
        {message && <p className="password-recovery-message" role="status">{message}</p>}
        <Link to="/auth"><FaArrowLeft /> Back to login</Link>
      </section>
    </main>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaArrowLeft, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import "../styles/PasswordRecovery.css";
import { API_ROOT } from "../utils/courseApi";

const requirements = [
  ["At least 8 characters", (value) => value.length >= 8],
  ["One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["One lowercase letter", (value) => /[a-z]/.test(value)],
  ["One number", (value) => /\d/.test(value)],
];

export default function ResetPassword() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!requirements.every(([, check]) => check(password))) {
      setError("Please meet every password requirement.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_ROOT}/auth/reset-password/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to reset password");
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setMessage(data.message);
      setPassword("");
      setConfirmation("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="password-recovery-page">
      <section className="password-recovery-card">
        <span className="password-recovery-icon"><FaLock /></span>
        <small>SECURE PASSWORD RESET</small>
        <h1>Create a new password</h1>
        <p>This link can be used once and expires 15 minutes after it was requested.</p>
        {!message && <form onSubmit={submit}>
          <label htmlFor="new-password">New password</label>
          <div className="password-recovery-input">
            <input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide new password" : "Show new password"} aria-pressed={showPassword}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          <ul className="password-requirements">
            {requirements.map(([label, check]) => <li className={check(password) ? "met" : ""} key={label}>{label}</li>)}
          </ul>
          <label htmlFor="confirm-password">Confirm new password</label>
          <div className="password-recovery-input">
            <input id="confirm-password" type={showConfirmation ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required autoComplete="new-password" />
            <button type="button" onClick={() => setShowConfirmation((visible) => !visible)} aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"} aria-pressed={showConfirmation}>
              {showConfirmation ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          <button type="submit" disabled={loading}>{loading ? "Resetting…" : "Reset password"}</button>
        </form>}
        {(error || message) && <p className={`password-recovery-message ${error ? "error" : "success"}`} role="status">{error || message}</p>}
        <Link to="/auth"><FaArrowLeft /> Return to login</Link>
      </section>
    </main>
  );
}

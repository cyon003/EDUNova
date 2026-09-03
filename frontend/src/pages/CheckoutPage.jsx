import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaEnvelope,
  FaLock,
  FaShoppingBag,
  FaSpinner,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { API_ROOT } from "../utils/courseApi";
import "../styles/CheckoutPage.css";

const API = API_ROOT;

const STEP = {
  EMAIL: "email",
  OTP: "otp",
  PROCESSING: "processing",
};

export default function CheckoutPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(STEP.EMAIL);
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [cartLoading, setCartLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // --------------------------------------------------
  // Load cart
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadCart = async () => {
      try {
        /*
         * IMPORTANT:
         * Do NOT manually add Authorization here.
         *
         * authClient.js intercepts fetch() and automatically
         * adds the real in-memory JWT.
         */
        const res = await fetch(`${API}/cart`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (res.status === 401) {
          setError(
            "Your login session has expired. Please log in again."
          );
          setCartLoading(false);
          return;
        }

        if (!res.ok) {
          setError(data.message || "Unable to load your cart.");
          setCartLoading(false);
          return;
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
          navigate("/cart");
          return;
        }

        setCart({
          items: data.items,
          total: Number(data.total || 0),
        });

        setCartLoading(false);
      } catch (err) {
        console.error("Checkout cart error:", err);

        if (!cancelled) {
          setError("Unable to connect to the server.");
          setCartLoading(false);
        }
      }
    };

    loadCart();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // --------------------------------------------------
  // Pre-fill email from stored user
  // --------------------------------------------------
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));

      if (user?.email) {
        setEmail(user.email);
      }
    } catch {
      // Ignore invalid localStorage data
    }
  }, []);

  // --------------------------------------------------
  // OTP countdown
  // --------------------------------------------------
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // --------------------------------------------------
  // Send OTP
  // --------------------------------------------------
  const sendOtp = async (e) => {
    e.preventDefault();

    setError("");
    setInfo("");

    const trimmedEmail = email.trim();

    if (
      !trimmedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      setError("Please enter a valid email address.");
      return;
    }

    setSending(true);

    try {
      /*
       * IMPORTANT:
       * Do NOT manually add Authorization here.
       *
       * authClient.js intercepts fetch() and automatically
       * adds the real in-memory JWT.
       */
      const res = await fetch(`${API}/checkout/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setError(
          "Your login session has expired. Please log in again."
        );
        return;
      }

      if (!res.ok) {
        setError(
          data.message || "Unable to send verification code."
        );
        return;
      }

      setEmail(trimmedEmail);
      setOtp(["", "", "", "", "", ""]);
      setStep(STEP.OTP);

      setInfo(
        `A 6-digit verification code was sent to ${trimmedEmail}.`
      );

      setCountdown(60);
    } catch (err) {
      console.error("Send OTP error:", err);

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  // --------------------------------------------------
  // OTP input
  // --------------------------------------------------
  const handleOtpChange = (value, index) => {
    const cleaned = value.replace(/\D/g, "");

    if (cleaned.length > 1) return;

    const nextOtp = [...otp];

    nextOtp[index] = cleaned;

    setOtp(nextOtp);

    if (cleaned && index < 5) {
      document
        .getElementById(`otp-${index + 1}`)
        ?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      document
        .getElementById(`otp-${index - 1}`)
        ?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (pasted.length === 0) return;

    const nextOtp = ["", "", "", "", "", ""];

    pasted.split("").forEach((digit, index) => {
      nextOtp[index] = digit;
    });

    setOtp(nextOtp);

    const focusIndex = Math.min(pasted.length - 1, 5);

    document
      .getElementById(`otp-${focusIndex}`)
      ?.focus();
  };

  // --------------------------------------------------
  // Verify OTP and pay
  // --------------------------------------------------
  const verifyAndPay = async (e) => {
    e.preventDefault();

    setError("");
    setInfo("");

    const otpString = otp.join("");

    if (otpString.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    setStep(STEP.PROCESSING);

    try {
      /*
       * IMPORTANT:
       * Do NOT manually add Authorization here.
       *
       * authClient.js intercepts fetch() and automatically
       * adds the real in-memory JWT.
       */
      const res = await fetch(`${API}/checkout/verify-and-pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          otp: otpString,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setStep(STEP.OTP);
        setError(
          "Your login session has expired. Please log in again."
        );
        return;
      }

      if (!res.ok) {
        setStep(STEP.OTP);

        setError(
          data.message || "Payment failed. Please try again."
        );

        return;
      }

      // --------------------------------------------------
      // Update enrolled course cache
      // --------------------------------------------------
      const enrolledCourses = data.enrolledCourses || [];

      if (enrolledCourses.length > 0) {
        try {
          const existing = JSON.parse(
            localStorage.getItem(
              "edunova-enrolled-courses"
            ) || "[]"
          );

          const merged = [
            ...new Set([
              ...existing,
              ...enrolledCourses,
            ]),
          ];

          localStorage.setItem(
            "edunova-enrolled-courses",
            JSON.stringify(merged)
          );
        } catch {
          // Ignore localStorage errors
        }
      }

      // --------------------------------------------------
      // Payment successful
      // --------------------------------------------------
      navigate("/order-success", {
        state: {
          order: data.order,
        },
      });
    } catch (err) {
      console.error("Payment error:", err);

      setStep(STEP.OTP);

      setError(
        "Unable to connect to the server. Please try again."
      );
    }
  };

  // --------------------------------------------------
  // Loading screen
  // --------------------------------------------------
  if (cartLoading) {
    return (
      <main className="checkout-page">
        <div className="checkout-loading">
          <FaSpinner className="spin" />
          Loading checkout...
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // Checkout page
  // --------------------------------------------------
  return (
    <main className="checkout-page">

      {/* Header */}
      <div className="checkout-header">
        <Link
          to="/cart"
          className="checkout-back"
        >
          <FaArrowLeft />
          Back to Cart
        </Link>

        <h1>
          <FaLock />
          Secure Checkout
        </h1>
      </div>

      <div className="checkout-layout">

        {/* Left side */}
        <div className="checkout-form-wrap">

          {/* Step indicator */}
          <div className="checkout-steps">

            <div
              className={`checkout-step ${
                step !== STEP.EMAIL
                  ? "done"
                  : "active"
              }`}
            >
              <div className="step-circle">
                {step !== STEP.EMAIL
                  ? <FaCheckCircle />
                  : "1"}
              </div>

              <span>Verify Email</span>
            </div>

            <div className="step-line" />

            <div
              className={`checkout-step ${
                step === STEP.PROCESSING
                  ? "done"
                  : step === STEP.OTP
                  ? "active"
                  : ""
              }`}
            >
              <div className="step-circle">
                {step === STEP.PROCESSING
                  ? <FaCheckCircle />
                  : "2"}
              </div>

              <span>Enter Code</span>
            </div>

            <div className="step-line" />

            <div
              className={`checkout-step ${
                step === STEP.PROCESSING
                  ? "active"
                  : ""
              }`}
            >
              <div className="step-circle">
                3
              </div>

              <span>Pay</span>
            </div>

          </div>

          {/* Error */}
          {error && (
            <div className="checkout-error">
              {error}
            </div>
          )}

          {/* Info */}
          {info && (
            <div className="checkout-info">
              {info}
            </div>
          )}

          {/* ---------------------------------------- */}
          {/* STEP 1: EMAIL */}
          {/* ---------------------------------------- */}

          {step === STEP.EMAIL && (
            <form
              className="checkout-card"
              onSubmit={sendOtp}
            >

              <div className="checkout-card-title">
                <FaEnvelope />
                Enter your email
              </div>

              <p className="checkout-card-sub">
                We'll send a 6-digit verification code
                to confirm your payment.
              </p>

              <div className="checkout-field">
                <label htmlFor="checkout-email">
                  Email Address
                </label>

                <input
                  id="checkout-email"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="checkout-btn-primary"
                disabled={sending}
              >
                {sending ? (
                  <>
                    <FaSpinner className="spin" />
                    Sending...
                  </>
                ) : (
                  "Send Verification Code"
                )}
              </button>

            </form>
          )}

          {/* ---------------------------------------- */}
          {/* STEP 2: OTP */}
          {/* ---------------------------------------- */}

          {step === STEP.OTP && (
            <form
              className="checkout-card"
              onSubmit={verifyAndPay}
            >

              <div className="checkout-card-title">
                <FaLock />
                Enter verification code
              </div>

              <p className="checkout-card-sub">
                Enter the 6-digit code sent to{" "}
                <strong>{email}</strong>
              </p>

              <div
                className="otp-boxes"
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      handleOtpChange(
                        e.target.value,
                        i
                      )
                    }
                    onKeyDown={(e) =>
                      handleOtpKeyDown(e, i)
                    }
                    className="otp-box"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <button
                type="submit"
                className="checkout-btn-primary"
                disabled={otp.join("").length !== 6}
              >
                <FaLock />
                Confirm &amp; Pay{" "}
                {cart.total > 0
                  ? `$${cart.total.toFixed(2)}`
                  : "(Free)"}
              </button>

              <div className="otp-resend">
                {countdown > 0 ? (
                  <span>
                    Resend code in {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    className="otp-resend-btn"
                    onClick={sendOtp}
                    disabled={sending}
                  >
                    {sending
                      ? "Sending..."
                      : "Resend code"}
                  </button>
                )}
              </div>

              <button
                type="button"
                className="checkout-btn-ghost"
                onClick={() => {
                  setStep(STEP.EMAIL);
                  setOtp([
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                  ]);
                  setError("");
                  setInfo("");
                }}
              >
                ← Change email
              </button>

            </form>
          )}

          {/* ---------------------------------------- */}
          {/* STEP 3: PROCESSING */}
          {/* ---------------------------------------- */}

          {step === STEP.PROCESSING && (
            <div className="checkout-card checkout-processing">

              <FaSpinner className="spin processing-icon" />

              <h2>
                Processing your payment...
              </h2>

              <p>
                Please wait while we confirm your order.
              </p>

            </div>
          )}

        </div>

        {/* Right side - Order summary */}
        <aside className="checkout-summary">

          <h2>
            Order Summary
          </h2>

          <div className="checkout-summary-items">

            {cart.items.map(
              (item) =>
                item.course && (
                  <div
                    key={item.course._id}
                    className="checkout-summary-item"
                  >

                    <div className="checkout-summary-thumb">

                      {item.course.thumbnail ? (
                        <img
                          src={`${
                            import.meta.env.VITE_API_ORIGIN ||
                            "http://localhost:5050"
                          }${item.course.thumbnail}`}
                          alt={item.course.name}
                        />
                      ) : (
                        <div className="checkout-thumb-placeholder">
                          <FaShoppingBag />
                        </div>
                      )}

                    </div>

                    <div className="checkout-summary-info">

                      <span className="checkout-summary-name">
                        {item.course.name}
                      </span>

                      <span className="checkout-summary-level">
                        {item.course.level}
                      </span>

                    </div>

                    <span className="checkout-summary-price">
                      {item.course.price > 0
                        ? `$${Number(
                            item.course.price
                          ).toFixed(2)}`
                        : "Free"}
                    </span>

                  </div>
                )
            )}

          </div>

          <div className="checkout-summary-total">
            <span>Total</span>

            <strong>
              {cart.total > 0
                ? `$${Number(cart.total).toFixed(2)}`
                : "Free"}
            </strong>
          </div>

          <div className="checkout-secure-note">
            <FaLock />
            Secured &amp; verified payment
          </div>

        </aside>

      </div>

    </main>
  );
}
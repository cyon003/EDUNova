import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaLock,
  FaShoppingBag,
  FaSpinner,
  FaTimesCircle,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import {
  API_ROOT,
  apiAssetUrl,
  formatCoursePrice,
} from "../utils/courseApi";
import "../styles/CheckoutPage.css";

const API = API_ROOT;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const query = new URLSearchParams(location.search);

  const orderId = query.get("orderId");
  const checkoutSource = query.get("from");
  const paymentResult = query.get("payment");
  const stripeSessionId = query.get("session_id");

  const [order, setOrder] = useState(null);

  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const isSubscription = order?.paymentType === "subscription";
  const isCompleted = order?.status === "completed";
  const totalAmount = Number(order?.totalAmount || 0);

  // --------------------------------------------------
  // Load order
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/auth");
          return;
        }

        // --------------------------------------------------
        // Existing order / Buy Now
        // --------------------------------------------------

        if (orderId) {
          const response = await fetch(
            `${API}/orders/${encodeURIComponent(orderId)}`,
            {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const data = await response.json().catch(() => ({}));

          if (cancelled) return;

          if (response.status === 401) {
            setError(
              "Your login session has expired. Please log in again."
            );
            setLoading(false);
            return;
          }

          if (!response.ok) {
            setError(data.message || "Unable to load this order.");
            setLoading(false);
            return;
          }

          setOrder(data);
          setLoading(false);
          return;
        }

        // --------------------------------------------------
        // Cart checkout
        // --------------------------------------------------

        const response = await fetch(`${API}/cart`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.status === 401) {
          setError(
            "Your login session has expired. Please log in again."
          );
          setLoading(false);
          return;
        }

        if (!response.ok) {
          setError(data.message || "Unable to load your cart.");
          setLoading(false);
          return;
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
          navigate("/cart");
          return;
        }

        const courseIds = data.items
          .filter((item) => item.course?._id)
          .map((item) => item.course._id);

        if (courseIds.length === 0) {
          setError("Your cart does not contain any valid courses.");
          setLoading(false);
          return;
        }

        const checkoutResponse = await fetch(
          `${API}/orders/checkout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              courseIds,
            }),
          }
        );

        const checkoutData = await checkoutResponse
          .json()
          .catch(() => ({}));

        if (cancelled) return;

        if (!checkoutResponse.ok) {
          setError(
            checkoutData.message || "Unable to create your order."
          );
          setLoading(false);
          return;
        }

        if (!checkoutData.order?._id) {
          setError("The server did not return an order.");
          setLoading(false);
          return;
        }

        setOrder(checkoutData.order);

        navigate(
          `/checkout?orderId=${encodeURIComponent(
            checkoutData.order._id
          )}&from=cart`,
          { replace: true }
        );

        setLoading(false);
      } catch (err) {
        console.error("Load checkout error:", err);

        if (!cancelled) {
          setError(
            "Unable to connect to the server. Please try again."
          );
          setLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [navigate, orderId]);

  // --------------------------------------------------
  // Verify Stripe payment after returning from Stripe
  // --------------------------------------------------

  useEffect(() => {
    if (!stripeSessionId || paymentResult !== "success") {
      return;
    }

    let cancelled = false;

    const verifyPayment = async () => {
      try {
        setVerifyingPayment(true);
        setError("");
        setInfo("Verifying your Stripe payment...");

        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/auth");
          return;
        }

        const response = await fetch(
          `${API}/stripe/verify-session`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              sessionId: stripeSessionId,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.status === 401) {
          setError(
            "Your login session has expired. Please log in again."
          );
          setVerifyingPayment(false);
          return;
        }

        if (!response.ok) {
          setError(
            data.message || "Unable to verify your Stripe payment."
          );
          setInfo("");
          setVerifyingPayment(false);
          return;
        }

        if (!data.paid) {
          setError(
            data.message ||
              "Stripe has not confirmed this payment as paid."
          );
          setInfo("");
          setVerifyingPayment(false);
          return;
        }

        setOrder(data.order);
        setInfo("Payment verified successfully.");
        setVerifyingPayment(false);
      } catch (err) {
        console.error("Stripe verification error:", err);

        if (!cancelled) {
          setError(
            "Unable to verify your payment. Please try again."
          );
          setInfo("");
          setVerifyingPayment(false);
        }
      }
    };

    verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [navigate, paymentResult, stripeSessionId]);

  // --------------------------------------------------
  // Start Stripe Checkout
  // --------------------------------------------------

  useEffect(() => {
    if (loading || !order?._id) {
      return;
    }

    if (paymentResult === "success") {
      return;
    }

    if (paymentResult === "cancelled") {
      setInfo("Your Stripe payment was cancelled.");
      return;
    }

    if (order.status === "completed") {
      return;
    }

    /*
     * Stripe course checkout is currently implemented here.
     * Subscription checkout will be connected separately.
     */
    if (order.paymentType !== "course") {
      setError(
        "Stripe checkout for Premium subscriptions is not connected yet."
      );
      return;
    }

    if (Number(order.totalAmount) <= 0) {
      setInfo("This course is free. No payment is required.");
      return;
    }

    let cancelled = false;

    const createStripeCheckout = async () => {
      try {
        setProcessingPayment(true);
        setError("");
        setInfo("Preparing secure Stripe checkout...");

        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/auth");
          return;
        }

        const response = await fetch(
          `${API}/stripe/create-checkout-session`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              orderId: order._id,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.status === 401) {
          setError(
            "Your login session has expired. Please log in again."
          );
          setProcessingPayment(false);
          return;
        }

        if (!response.ok) {
          setError(
            data.message ||
              "Unable to start Stripe checkout."
          );
          setInfo("");
          setProcessingPayment(false);
          return;
        }

        if (!data.checkoutUrl) {
          setError(
            "Stripe did not return a checkout URL."
          );
          setInfo("");
          setProcessingPayment(false);
          return;
        }

        /*
         * Redirect the browser to Stripe's hosted Checkout page.
         */
        window.location.href = data.checkoutUrl;
      } catch (err) {
        console.error(
          "Create Stripe checkout error:",
          err
        );

        if (!cancelled) {
          setError(
            "Unable to connect to Stripe checkout."
          );
          setInfo("");
          setProcessingPayment(false);
        }
      }
    };

    createStripeCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    navigate,
    order,
    paymentResult,
  ]);

  // --------------------------------------------------
  // Back navigation
  // --------------------------------------------------

  const handleBack = () => {
    if (isSubscription || checkoutSource === "subscription") {
      navigate("/subscription");
      return;
    }

    if (checkoutSource === "cart") {
      navigate("/cart");
      return;
    }

    if (orderId) {
      const firstCourse = order?.items?.[0]?.course;

      if (firstCourse?.slug) {
        navigate(`/courses/${firstCourse.slug}`);
        return;
      }
    }

    navigate("/cart");
  };

  // --------------------------------------------------
  // Home navigation
  // --------------------------------------------------

  const handleHome = () => {
    navigate("/home");
  };

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="checkout-page">
        <div className="checkout-loading" role="status">
          <FaSpinner className="spin" />
          Loading your order…
        </div>
      </main>
    );
  }

  const currentStep = isCompleted
    ? 3
    : paymentResult === "success"
      ? 2
      : 1;

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <button
          type="button"
          className="checkout-back"
          onClick={handleBack}
        >
          <FaArrowLeft /> Back
        </button>

        <button
          type="button"
          className="checkout-brand"
          onClick={handleHome}
        >
          EDUNOVA<span> / CHECKOUT</span>
        </button>

        <span className="checkout-header-note">
          <FaLock /> Secure checkout
        </span>
      </header>

      <div className="checkout-intro">
        <p className="checkout-eyebrow">
          YOUR NEXT CHAPTER
        </p>

        <h1>
          {isCompleted
            ? "You’re ready to learn."
            : paymentResult === "success"
              ? "Checking your payment."
              : "Secure payment with Stripe."}
        </h1>

        <p>
          {isCompleted
            ? "Your payment has been verified and your course is ready."
            : paymentResult === "success"
              ? "EDUNova is verifying the payment directly with Stripe."
              : "You’ll be redirected to Stripe’s secure test checkout to complete your purchase."}
        </p>
      </div>

      {!order ? (
        <section
          className="checkout-card checkout-empty"
          role="alert"
        >
          <FaTimesCircle />
          <h2>We couldn’t load this order</h2>
          <p>
            {error ||
              "Return to your cart and try again."}
          </p>

          <button
            type="button"
            className="checkout-btn-primary"
            onClick={handleBack}
          >
            Back to cart
          </button>
        </section>
      ) : (
        <>
          <ol
            className="checkout-steps"
            aria-label="Payment progress"
          >
            {[
              "Order",
              "Stripe payment",
              "Start learning",
            ].map((label, index) => (
              <li
                key={label}
                className={
                  index + 1 <= currentStep
                    ? "active"
                    : ""
                }
                aria-current={
                  index + 1 === currentStep
                    ? "step"
                    : undefined
                }
              >
                <span>
                  {index + 1 < currentStep ? (
                    <FaCheckCircle />
                  ) : (
                    `0${index + 1}`
                  )}
                </span>

                {label}
              </li>
            ))}
          </ol>

          <div className="checkout-layout">
            <div className="checkout-form-wrap">
              {error && (
                <div
                  className="checkout-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {info && (
                <div
                  className="checkout-info"
                  role="status"
                >
                  {info}
                </div>
              )}

              {processingPayment && (
                <section className="checkout-card checkout-processing">
                  <FaSpinner className="spin processing-icon" />

                  <p className="checkout-eyebrow">
                    SECURE CHECKOUT
                  </p>

                  <h2>
                    Preparing Stripe...
                  </h2>

                  <p>
                    We’re creating your secure
                    Stripe Test Mode checkout.
                  </p>

                  <div className="checkout-reference">
                    Order reference{" "}
                    <strong>
                      {order.orderReference}
                    </strong>
                  </div>
                </section>
              )}

              {verifyingPayment && (
                <section className="checkout-card checkout-processing">
                  <FaSpinner className="spin processing-icon" />

                  <p className="checkout-eyebrow">
                    VERIFYING PAYMENT
                  </p>

                  <h2>
                    Checking with Stripe...
                  </h2>

                  <p>
                    Please wait while EDUNova
                    verifies your payment.
                  </p>

                  <div className="checkout-reference">
                    Order reference{" "}
                    <strong>
                      {order.orderReference}
                    </strong>
                  </div>
                </section>
              )}

              {paymentResult === "cancelled" &&
                !isCompleted && (
                  <section className="checkout-card checkout-processing">
                    <FaTimesCircle className="processing-icon" />

                    <p className="checkout-eyebrow">
                      PAYMENT CANCELLED
                    </p>

                    <h2>
                      No payment was completed.
                    </h2>

                    <p>
                      Your order is still waiting
                      for payment. You can try
                      Stripe checkout again.
                    </p>

                    <button
                      type="button"
                      className="checkout-btn-primary"
                      onClick={() =>
                        window.location.href =
                          `/checkout?orderId=${encodeURIComponent(
                            order._id
                          )}${
                            checkoutSource
                              ? `&from=${encodeURIComponent(
                                  checkoutSource
                                )}`
                              : ""
                          }`
                      }
                    >
                      Try payment again
                    </button>
                  </section>
                )}

              {isCompleted && (
                <section className="checkout-card checkout-processing">
                  <FaCheckCircle className="processing-icon" />

                  <p className="checkout-eyebrow">
                    PAYMENT VERIFIED
                  </p>

                  <h2>
                    Your learning starts here.
                  </h2>

                  <p>
                    Stripe confirmed the payment
                    and EDUNova has activated your
                    course access.
                  </p>

                  <div className="checkout-reference">
                    Order reference{" "}
                    <strong>
                      {order.orderReference}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="checkout-btn-primary"
                    onClick={() =>
                      navigate("/my-courses")
                    }
                  >
                    Go to my learning
                  </button>
                </section>
              )}

              {!processingPayment &&
                !verifyingPayment &&
                !isCompleted &&
                paymentResult !== "cancelled" &&
                !error && (
                  <section className="checkout-card checkout-processing">
                    <FaLock className="processing-icon" />

                    <p className="checkout-eyebrow">
                      STRIPE TEST MODE
                    </p>

                    <h2>
                      Secure payment
                    </h2>

                    <p>
                      You will be redirected to
                      Stripe’s hosted checkout page.
                      This EDUNova test uses Stripe
                      Test Mode and does not charge
                      real money.
                    </p>
                  </section>
                )}
            </div>

            <aside
              className="checkout-summary"
              aria-label="Order summary"
            >
              <p className="checkout-eyebrow">
                YOUR ORDER
              </p>

              <h2>
                A good investment in you.
              </h2>

              <div className="checkout-summary-items">
                {order.items?.map(
                  (item, index) => (
                    <div
                      key={
                        item.course?._id ||
                        index
                      }
                      className="checkout-summary-item"
                    >
                      <div className="checkout-summary-thumb">
                        {item.course?.thumbnail ? (
                          <img
                            src={apiAssetUrl(
                              item.course.thumbnail
                            )}
                            alt=""
                          />
                        ) : (
                          <FaShoppingBag />
                        )}
                      </div>

                      <div className="checkout-summary-info">
                        <span className="checkout-summary-name">
                          {item.course?.name ||
                            "Course unavailable"}
                        </span>

                        <span className="checkout-summary-level">
                          {item.course?.level ||
                            "Online course"}
                        </span>
                      </div>

                      <span className="checkout-summary-price">
                        {Number(item.price || 0) >
                        0
                          ? formatCoursePrice(
                              item.price
                            )
                          : "Free"}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="checkout-summary-total">
                <span>Total due</span>

                <strong>
                  {totalAmount > 0
                    ? formatCoursePrice(
                        totalAmount
                      )
                    : "Free"}
                </strong>
              </div>

              <dl className="checkout-order-meta">
                <div>
                  <dt>Reference</dt>
                  <dd>
                    {order.orderReference}
                  </dd>
                </div>

                <div>
                  <dt>Status</dt>
                  <dd>
                    {isCompleted
                      ? "Paid"
                      : paymentResult ===
                          "cancelled"
                        ? "Payment cancelled"
                        : "Awaiting payment"}
                  </dd>
                </div>
              </dl>

              <p className="checkout-secure-note">
                <FaLock /> Stripe handles the
                payment securely. EDUNova verifies
                the payment on the backend before
                granting course access.
              </p>

              <a
                className="checkout-support"
                href="mailto:support@edunova.com"
              >
                Need a hand? Contact support ↗
              </a>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
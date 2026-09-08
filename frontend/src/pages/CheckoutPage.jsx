import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaLock,
  FaQrcode,
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

  const [order, setOrder] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [qrObjectUrl, setQrObjectUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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

        // Create an order from the cart.
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
              courseIds: data.items
                .filter((item) => item.course?._id)
                .map((item) => item.course._id),
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

        // Keep track that this order came from cart checkout.
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
  // Load payment settings
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let createdUrl = "";

    const loadPaymentSettings = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) return;

        const response = await fetch(`${API}/payment-settings`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (!response.ok) {
          console.error(
            "Unable to load payment settings:",
            data.message || response.statusText
          );
          setQrLoading(false);
          return;
        }

        setPaymentSettings({
          receiverName: data.receiverName || "",
          paymentMethod: data.paymentMethod || "",
          accountName: data.accountName || "",
          accountNumber: data.accountNumber || "",
          isActive: data.isActive ?? true,
        });

        // The QR image lives behind an authenticated endpoint,
        // so fetch it manually with the auth header.
        if (!data.qrUrl) {
          setQrLoading(false);
          return;
        }

        try {
          const qrResponse = await fetch(
            `${API}/payment-settings/qr`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!qrResponse.ok) {
            throw new Error("QR code request failed");
          }

          const blob = await qrResponse.blob();
          createdUrl = URL.createObjectURL(blob);

          if (cancelled) {
            URL.revokeObjectURL(createdUrl);
          } else {
            setQrObjectUrl(createdUrl);
          }
        } catch (qrErr) {
          console.error("Load payment QR error:", qrErr);
        } finally {
          if (!cancelled) {
            setQrLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Load payment settings error:", err);
          setQrLoading(false);
        }
      }
    };

    loadPaymentSettings();

    return () => {
      cancelled = true;

      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, []);

  // --------------------------------------------------
  // Upload payment slip
  // --------------------------------------------------

  const uploadPaymentSlip = async () => {
    setError("");
    setInfo("");

    if (!order?._id) {
      setError("Order information is missing.");
      return;
    }

    if (!selectedFile) {
      setError("Please select your payment slip first.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Payment slip must be 5 MB or smaller.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError(
        "Please upload a JPG, PNG, WEBP, or PDF payment slip."
      );
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/auth");
      return;
    }

    const formData = new FormData();
    formData.append("paymentSlip", selectedFile);

    setUploading(true);

    try {
      const response = await fetch(
        `${API}/payment/${encodeURIComponent(order._id)}/slip`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setError(
          "Your login session has expired. Please log in again."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to upload payment slip."
        );
      }

      setOrder({
        ...order,
         ...(data.order || {}),
         status: "awaiting_verification",
        });

      setSelectedFile(null);

      const fileInput = document.getElementById(
        "payment-slip-input"
      );

      if (fileInput) {
        fileInput.value = "";
      }

      setInfo(
        "Payment slip submitted successfully. Your payment is now awaiting verification."
      );
    } catch (err) {
      console.error("Payment slip upload error:", err);

      setError(
        err.message ||
          "Unable to upload your payment slip. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  // --------------------------------------------------
  // Back navigation
  // --------------------------------------------------

  const handleBack = () => {
    // Cart checkout -> Cart
    if (checkoutSource === "cart") {
      navigate("/cart");
      return;
    }

    // Buy Now -> Course Detail
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
    return <main className="checkout-page"><div className="checkout-loading" role="status"><FaSpinner className="spin" /> Loading your order…</div></main>;
  }

  const isCompleted = order?.status === "completed";
  const isAwaitingVerification = order?.status === "awaiting_verification";
  const isRejected = order?.status === "rejected";
  const isPending = order?.status === "pending";
  const totalAmount = Number(order?.totalAmount || 0);
  const currentStep = isCompleted ? 3 : isAwaitingVerification ? 2 : 1;

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <button type="button" className="checkout-back" onClick={handleBack}><FaArrowLeft /> Back</button>
        <button type="button" className="checkout-brand" onClick={handleHome}>EDUNOVA<span> / CHECKOUT</span></button>
        <span className="checkout-header-note"><FaLock /> Secure checkout</span>
      </header>

      <div className="checkout-intro">
        <p className="checkout-eyebrow">YOUR NEXT CHAPTER</p>
        <h1>{isCompleted ? "You’re ready to learn." : isAwaitingVerification ? "We’ve received your payment slip." : "A little closer to your next lesson."}</h1>
        <p>{isCompleted ? "Your payment is approved. Your courses are ready when you are." : "Pay by bank transfer, send your slip, and we’ll take care of the rest."}</p>
      </div>

      {!order ? (
        <section className="checkout-card checkout-empty" role="alert">
          <FaTimesCircle /><h2>We couldn’t load this order</h2>
          <p>{error || "Return to your cart and try again."}</p>
          <button type="button" className="checkout-btn-primary" onClick={handleBack}>Back to cart</button>
        </section>
      ) : (
        <>
          <ol className="checkout-steps" aria-label="Payment progress">
            {["Transfer payment", "Submit your slip", "Start learning"].map((label, index) => (
              <li key={label} className={index + 1 <= currentStep ? "active" : ""} aria-current={index + 1 === currentStep ? "step" : undefined}>
                <span>{index + 1 < currentStep ? <FaCheckCircle /> : `0${index + 1}`}</span>{label}
              </li>
            ))}
          </ol>
          <div className="checkout-layout">
            <div className="checkout-form-wrap">
              {error && <div className="checkout-error" role="alert">{error}</div>}
              {info && <div className="checkout-info" role="status">{info}</div>}

              {(isCompleted || isAwaitingVerification) && (
                <section className="checkout-card checkout-processing">
                  <FaCheckCircle className="processing-icon" />
                  <p className="checkout-eyebrow">{isCompleted ? "PAYMENT APPROVED" : "AWAITING VERIFICATION"}</p>
                  <h2>{isCompleted ? "Your learning starts here." : "Thanks. We’ll check it from here."}</h2>
                  <p>{isCompleted ? "Your course access is now available." : "An administrator will review your slip. Your courses become available once payment is approved."}</p>
                  <div className="checkout-reference">Order reference <strong>{order.orderReference}</strong></div>
                  <button type="button" className="checkout-btn-primary" onClick={() => navigate(isCompleted ? "/my-courses" : "/home")}>
                    {isCompleted ? "Go to my learning" : "Back to home"}
                  </button>
                </section>
              )}

              {isPending && (
                <section className="checkout-card">
                  <div className="checkout-section-heading"><span>01</span><div><h2>Make your transfer</h2><p>Scan with your banking app and transfer the exact amount.</p></div></div>
                  <div className="checkout-transfer">
                    <div className="checkout-qr">
                      {qrLoading ? <span role="status"><FaSpinner className="spin" /> Loading QR…</span> : qrObjectUrl ? <img src={qrObjectUrl} alt="Scan this QR code with your banking app to pay" /> : <div className="checkout-qr-empty"><FaQrcode /><strong>QR code unavailable</strong><p>Check the account details or contact support before transferring.</p></div>}
                    </div>
                    <div className="checkout-bank">
                      <p className="checkout-eyebrow">AMOUNT TO TRANSFER</p>
                      <strong className="checkout-amount">{formatCoursePrice(totalAmount)}</strong>
                      <dl className="checkout-bank-details">
                        <div><dt>Receiver</dt><dd>{paymentSettings?.receiverName || "Not configured"}</dd></div>
                        <div><dt>Payment method</dt><dd>{paymentSettings?.paymentMethod || "Not configured"}</dd></div>
                        <div><dt>Account name</dt><dd>{paymentSettings?.accountName || "Not configured"}</dd></div>
                        <div><dt>Account number</dt><dd className="checkout-account-number">{paymentSettings?.accountNumber || "Not configured"}</dd></div>
                      </dl>
                    </div>
                  </div>
                  <p className="checkout-transfer-note">Keep your bank receipt. You’ll need it for the next step.</p>
                </section>
              )}

              {(isPending || isRejected) && (
                <section className="checkout-card">
                  <div className="checkout-section-heading"><span>02</span><div><h2>{isRejected ? "Upload a new payment slip" : "Send your payment slip"}</h2><p>{isRejected ? "Your previous slip was rejected. Review the reason and try again." : "Upload the receipt from your bank after completing the transfer."}</p></div></div>
                  {isRejected && <div className="checkout-error" role="alert">{order.rejectionReason || "Please check your transfer details and upload a clear payment receipt."}</div>}
                  <PaymentUploadSection selectedFile={selectedFile} setSelectedFile={setSelectedFile} uploading={uploading} uploadPaymentSlip={uploadPaymentSlip} />
                </section>
              )}
            </div>

            <aside className="checkout-summary" aria-label="Order summary">
              <p className="checkout-eyebrow">YOUR ORDER</p><h2>A good investment in you.</h2>
              <div className="checkout-summary-items">
                {order.items?.map((item, index) => (
                  <div key={item.course?._id || index} className="checkout-summary-item">
                    <div className="checkout-summary-thumb">{item.course?.thumbnail ? <img src={apiAssetUrl(item.course.thumbnail)} alt="" /> : <FaShoppingBag />}</div>
                    <div className="checkout-summary-info"><span className="checkout-summary-name">{item.course?.name || "Course unavailable"}</span><span className="checkout-summary-level">{item.course?.level || "Online course"}</span></div>
                    <span className="checkout-summary-price">{Number(item.price || 0) > 0 ? formatCoursePrice(item.price) : "Free"}</span>
                  </div>
                ))}
              </div>
              <div className="checkout-summary-total"><span>Total due</span><strong>{totalAmount > 0 ? formatCoursePrice(totalAmount) : "Free"}</strong></div>
              <dl className="checkout-order-meta"><div><dt>Reference</dt><dd>{order.orderReference}</dd></div><div><dt>Status</dt><dd>{isCompleted ? "Approved" : isAwaitingVerification ? "Under review" : isRejected ? "Slip rejected" : "Awaiting payment"}</dd></div></dl>
              <p className="checkout-secure-note"><FaLock /> Payments are reviewed by our team before course access is granted.</p>
              <a className="checkout-support" href="mailto:support@edunova.com">Need a hand? Contact support ↗</a>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

function PaymentUploadSection({ selectedFile, setSelectedFile, uploading, uploadPaymentSlip }) {
  return (
    <div className="checkout-upload">
      <div className={`checkout-file-picker ${selectedFile ? "has-file" : ""}`}>
        <FaCloudUploadAlt aria-hidden="true" />
        <label htmlFor="payment-slip-input">{selectedFile ? selectedFile.name : "Choose your payment receipt"}</label>
        <span id="payment-file-help">JPG, PNG, WEBP or PDF · Up to 5 MB</span>
        <input id="payment-slip-input" type="file" aria-describedby="payment-file-help" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
      </div>
      <button type="button" className="checkout-btn-primary" onClick={uploadPaymentSlip} disabled={!selectedFile || uploading}>
        {uploading ? <><FaSpinner className="spin" /> Submitting…</> : <>Submit payment slip <span aria-hidden="true">→</span></>}
      </button>
      <p className="checkout-upload-note">Course access begins after your payment is approved.</p>
    </div>
  );
}

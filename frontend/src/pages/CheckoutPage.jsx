import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaHome,
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
    return (
      <main className="checkout-page">
        <div className="checkout-loading">
          <FaSpinner className="spin" />
          Loading payment...
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // Error
  // --------------------------------------------------

  if (!order) {
    return (
      <main className="checkout-page">
        <div className="checkout-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              type="button"
              className="checkout-back"
              onClick={handleBack}
            >
              <FaArrowLeft />
              Back
            </button>

            <button
              type="button"
              className="checkout-back"
              onClick={handleHome}
            >
              <FaHome />
              Home
            </button>
          </div>

          <h1>
            <FaLock />
            Payment
          </h1>
        </div>

        <div className="checkout-card">
          <div className="checkout-card-title">
            <FaTimesCircle />
            Unable to load payment
          </div>

          <p className="checkout-card-sub">
            {error || "The order could not be loaded."}
          </p>

          <button
            type="button"
            className="checkout-btn-primary"
            onClick={handleBack}
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  const isCompleted = order.status === "completed";
  const isAwaitingVerification =
    order.status === "awaiting_verification";
  const isRejected = order.status === "rejected";
  const isPending = order.status === "pending";

  const totalAmount = Number(order.totalAmount || 0);

  // --------------------------------------------------
  // Main payment page
  // --------------------------------------------------

  return (
    <main className="checkout-page">
      {/* Header */}
      <div className="checkout-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
            type="button"
            className="checkout-back"
            onClick={handleBack}
          >
            <FaArrowLeft />
            Back
          </button>

          <button
            type="button"
            className="checkout-back"
            onClick={handleHome}
          >
            <FaHome />
            Home
          </button>
        </div>

        <h1>
          <FaLock />
          Secure Payment
        </h1>
      </div>

      <div className="checkout-layout">
        {/* LEFT */}
        <div className="checkout-form-wrap">
          {/* Status message */}
          {error && (
            <div className="checkout-error">
              {error}
            </div>
          )}

          {info && (
            <div className="checkout-info">
              {info}
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* COMPLETED */}
          {/* ------------------------------------------------ */}

          {isCompleted && (
            <div className="checkout-card checkout-processing">
              <FaCheckCircle className="processing-icon" />

              <h2>Payment Completed</h2>

              <p>
                Your payment has been approved and your
                course access is available.
              </p>

              <button
                type="button"
                className="checkout-btn-primary"
                onClick={() => {
                  const firstCourse =
                    order.items?.[0]?.course;

                  if (firstCourse?.slug) {
                    navigate(
                      `/courses/${firstCourse.slug}`
                    );
                  } else {
                    navigate("/courses");
                  }
                }}
              >
                Go to Course
              </button>
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* AWAITING VERIFICATION */}
          {/* ------------------------------------------------ */}

          {isAwaitingVerification && (
            <div className="checkout-card checkout-processing">
              <FaCheckCircle className="processing-icon" />

              <h2>Payment Submitted</h2>

              <p>
                Your payment slip has been submitted
                successfully.
              </p>

              <p>
                Your order is now{" "}
                <strong>Awaiting Verification</strong>.
                An administrator will check your payment.
              </p>

              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "rgba(139, 92, 246, 0.10)",
                }}
              >
                <strong>Order Reference</strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "18px",
                    fontWeight: "700",
                  }}
                >
                  {order.orderReference}
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* REJECTED */}
          {/* ------------------------------------------------ */}

          {isRejected && (
            <div className="checkout-card">
              <div className="checkout-card-title">
                <FaTimesCircle />
                Payment Rejected
              </div>

              <p className="checkout-card-sub">
                Your previous payment slip was rejected.
                You can upload a new slip below.
              </p>

              {order.rejectionReason && (
                <div
                  className="checkout-error"
                  style={{ marginTop: "16px" }}
                >
                  <strong>Reason:</strong>{" "}
                  {order.rejectionReason}
                </div>
              )}

              <PaymentUploadSection
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                uploading={uploading}
                uploadPaymentSlip={uploadPaymentSlip}
              />
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* PENDING PAYMENT */}
          {/* ------------------------------------------------ */}

          {isPending && (
            <>
              {/* QR Payment */}
              <div className="checkout-card">
                <div className="checkout-card-title">
                  <FaQrcode />
                  Pay by QR Code
                </div>

                <p className="checkout-card-sub">
                  Transfer the exact amount shown below to
                  the receiver, then upload your payment
                  slip.
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    margin: "24px 0",
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      padding: "18px",
                      borderRadius: "16px",
                      minWidth: "250px",
                      minHeight: "250px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {qrLoading ? (
                      <FaSpinner
                        className="spin"
                        style={{
                          fontSize: "48px",
                          color: "#111",
                        }}
                      />
                    ) : qrObjectUrl ? (
                      <img
                        src={qrObjectUrl}
                        alt="Payment QR Code"
                        style={{
                          width: "220px",
                          height: "220px",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <FaQrcode
                        style={{
                          fontSize: "180px",
                          color: "#111",
                        }}
                      />
                    )}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "center",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      opacity: 0.75,
                    }}
                  >
                    Amount to transfer
                  </div>

                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: "800",
                      marginTop: "4px",
                    }}
                  >
                    {formatCoursePrice(totalAmount)}
                  </div>
                </div>

                <div
                  style={{
                    padding: "18px",
                    borderRadius: "12px",
                    background:
                      "rgba(139, 92, 246, 0.10)",
                  }}
                >
                  <div>
                    <strong>Receiver</strong>
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div>
                      <strong>Receiver Name:</strong>{" "}
                      {paymentSettings?.receiverName ||
                        "Not configured"}
                    </div>

                    <div>
                      <strong>Payment Method:</strong>{" "}
                      {paymentSettings?.paymentMethod ||
                        "Not configured"}
                    </div>

                    <div>
                      <strong>Account Name:</strong>{" "}
                      {paymentSettings?.accountName ||
                        "Not configured"}
                    </div>

                    <div>
                      <strong>Account Number:</strong>{" "}
                      {paymentSettings?.accountNumber ||
                        "Not configured"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order reference */}
              <div className="checkout-card">
                <div className="checkout-card-title">
                  <FaShoppingBag />
                  Order Information
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        opacity: 0.7,
                      }}
                    >
                      Order Reference
                    </div>

                    <strong>
                      {order.orderReference}
                    </strong>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        opacity: 0.7,
                      }}
                    >
                      Payment Status
                    </div>

                    <strong>
                      Waiting for payment slip
                    </strong>
                  </div>
                </div>
              </div>

              {/* Upload */}
              <div className="checkout-card">
                <div className="checkout-card-title">
                  <FaCloudUploadAlt />
                  Upload Payment Slip
                </div>

                <p className="checkout-card-sub">
                  After completing the bank transfer, upload
                  your payment slip here.
                </p>

                <PaymentUploadSection
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                  uploading={uploading}
                  uploadPaymentSlip={uploadPaymentSlip}
                />
              </div>
            </>
          )}
        </div>

        {/* RIGHT - ORDER SUMMARY */}
        <aside className="checkout-summary">
          <h2>Order Summary</h2>

          <div className="checkout-summary-items">
            {order.items?.map(
              (item, index) =>
                item.course && (
                  <div
                    key={
                      item.course._id ||
                      `${item.course.slug}-${index}`
                    }
                    className="checkout-summary-item"
                  >
                    <div className="checkout-summary-thumb">
                      {item.course.thumbnail ? (
                        <img
                          src={apiAssetUrl(
                            item.course.thumbnail
                          )}
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

                      {item.course.level && (
                        <span className="checkout-summary-level">
                          {item.course.level}
                        </span>
                      )}
                    </div>

                    <span className="checkout-summary-price">
                      {Number(item.price || 0) > 0
                        ? formatCoursePrice(item.price)
                        : "Free"}
                    </span>
                  </div>
                )
            )}
          </div>

          <div className="checkout-summary-total">
            <span>Total</span>

            <strong>
              {totalAmount > 0
                ? formatCoursePrice(totalAmount)
                : "Free"}
            </strong>
          </div>

          <div className="checkout-secure-note">
            <FaLock />
            Manual payment verified by admin
          </div>
        </aside>
      </div>
    </main>
  );
}

// --------------------------------------------------
// Payment upload component
// --------------------------------------------------

function PaymentUploadSection({
  selectedFile,
  setSelectedFile,
  uploading,
  uploadPaymentSlip,
}) {
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <label
        htmlFor="payment-slip-input"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          padding: "30px 20px",
          border: "1px dashed rgba(167, 139, 250, 0.6)",
          borderRadius: "14px",
          cursor: "pointer",
          textAlign: "center",
        }}
      >
        <FaCloudUploadAlt
          style={{
            fontSize: "38px",
            color: "#a78bfa",
          }}
        />

        <strong>
          {selectedFile
            ? selectedFile.name
            : "Choose your payment slip"}
        </strong>

        <span
          style={{
            fontSize: "13px",
            opacity: 0.7,
          }}
        >
          JPG, PNG, WEBP or PDF — maximum 5 MB
        </span>
      </label>

      <input
        id="payment-slip-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <button
        type="button"
        className="checkout-btn-primary"
        onClick={uploadPaymentSlip}
        disabled={!selectedFile || uploading}
        style={{ marginTop: "16px" }}
      >
        {uploading ? (
          <>
            <FaSpinner className="spin" />
            Uploading...
          </>
        ) : (
          <>
            <FaCloudUploadAlt />
            Submit Payment Slip
          </>
        )}
      </button>
    </div>
  );
}
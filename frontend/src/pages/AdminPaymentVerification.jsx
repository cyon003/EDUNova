import { useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaEye,
  FaTimes,
  FaSyncAlt,
  FaSearch,
  FaClipboardList,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaCopy,
  FaChevronLeft,
  FaChevronRight,
  FaImage,
} from "react-icons/fa";
import { API_ROOT } from "../utils/courseApi";
import AdminLayout from "../components/AdminLayout";
import "../styles/AdminLayout.css";
import "../styles/AdminPaymentVerification.css";

const PAGE_SIZE = 10;

const STATUS_META = {
  awaiting_verification: { label: "Awaiting Verification", className: "pv-badge--pending" },
  approved: { label: "Approved", className: "pv-badge--approved" },
  rejected: { label: "Rejected", className: "pv-badge--rejected" },
};

function getToken() {
  return localStorage.getItem("token");
}

function formatPrice(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "THB 0.00";
  }

  return new Intl.NumberFormat("en-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getOrderStatus(order) {
  return order.status || "awaiting_verification";
}

function coursesSummary(order) {
  const items = order.items || [];

  if (items.length === 0) {
    return "Course unavailable";
  }

  const firstName = items[0].course?.name || "Course unavailable";

  if (items.length === 1) {
    return firstName;
  }

  return `${firstName} +${items.length - 1} more`;
}

export default function AdminPaymentVerification() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [slipUrl, setSlipUrl] = useState("");
  const [slipLoading, setSlipLoading] = useState(false);

  const [processingId, setProcessingId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [copied, setCopied] = useState(false);

  const loadOrders = async (showRefresh = false) => {
    const token = getToken();

    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(
        `${API_ROOT}/admin/payment-verification`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load payment verification orders."
        );
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setError(
        err.message || "Unable to load payment verification orders."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const openOrder = async (order) => {
    setSelectedOrder(order);
    setSlipUrl("");
    setSlipLoading(true);
    setRejectionReason("");
    setError("");

    const token = getToken();

    if (!token) {
      setSlipLoading(false);
      setError("You are not logged in.");
      return;
    }

    try {
      const response = await fetch(
        `${API_ROOT}/admin/payment-verification/${order._id}/slip`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.message || "Unable to load payment slip."
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setSlipUrl(url);
    } catch (err) {
      setError(err.message || "Unable to load payment slip.");
    } finally {
      setSlipLoading(false);
    }
  };

  const closeOrder = () => {
    if (slipUrl) {
      URL.revokeObjectURL(slipUrl);
    }

    setSelectedOrder(null);
    setSlipUrl("");
    setRejectionReason("");
  };

  const approveOrder = async (orderId) => {
    const token = getToken();

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to approve this payment?"
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(orderId);
    setError("");

    try {
      const response = await fetch(
        `${API_ROOT}/admin/payment-verification/${orderId}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to approve payment."
        );
      }

      closeOrder();

      await loadOrders(true);
    } catch (err) {
      setError(err.message || "Unable to approve payment.");
    } finally {
      setProcessingId("");
    }
  };

  const rejectOrder = async (orderId) => {
    const token = getToken();

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    const reason = rejectionReason.trim();

    if (!reason) {
      setError("Please enter a rejection reason.");
      return;
    }

    if (reason.length > 1000) {
      setError("Rejection reason cannot exceed 1000 characters.");
      return;
    }

    setProcessingId(orderId);
    setError("");

    try {
      const response = await fetch(
        `${API_ROOT}/admin/payment-verification/${orderId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to reject payment."
        );
      }

      closeOrder();

      await loadOrders(true);
    } catch (err) {
      setError(err.message || "Unable to reject payment.");
    } finally {
      setProcessingId("");
    }
  };

  useEffect(() => {
    return () => {
      if (slipUrl) {
        URL.revokeObjectURL(slipUrl);
      }
    };
  }, [slipUrl]);

  const counts = useMemo(() => {
    const result = { all: orders.length, awaiting_verification: 0, approved: 0, rejected: 0 };

    orders.forEach((order) => {
      const status = getOrderStatus(order);
      result[status] = (result[status] || 0) + 1;
    });

    return result;
  }, [orders]);

  const tabStatusMap = {
    all: null,
    pending: "awaiting_verification",
    approved: "approved",
    rejected: "rejected",
  };

  const filteredOrders = useMemo(() => {
    const targetStatus = tabStatusMap[activeTab];
    const term = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      if (targetStatus && getOrderStatus(order) !== targetStatus) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        order.orderReference?.toLowerCase().includes(term) ||
        order.student?.name?.toLowerCase().includes(term) ||
        order.student?.email?.toLowerCase().includes(term)
      );
    });
  }, [orders, activeTab, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const pageOrders = filteredOrders.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const copyOrderReference = async (reference) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard not available — ignore silently.
    }
  };

  const selectedStatus = selectedOrder ? getOrderStatus(selectedOrder) : null;
  const selectedStatusMeta = selectedStatus ? STATUS_META[selectedStatus] : null;

  return (
    <AdminLayout
      title="Payment Verification"
      subtitle="Review student payment slips and approve or reject payments."
    >
      <div className="pv-page">
        <div className="pv-actions-row">
          <button
            type="button"
            className="pv-refresh-btn"
            onClick={() => loadOrders(true)}
            disabled={refreshing}
          >
            <FaSyncAlt className={refreshing ? "pv-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="pv-error">{error}</div>}

      <div className="pv-stats">
        <div className="pv-stat-card">
          <div className="pv-stat-icon pv-stat-icon--total">
            <FaClipboardList />
          </div>
          <div className="pv-stat-value">{counts.all}</div>
          <div className="pv-stat-label">Total Orders</div>
          <div className="pv-stat-sub">All payment orders</div>
        </div>

        <div className="pv-stat-card">
          <div className="pv-stat-icon pv-stat-icon--pending">
            <FaClock />
          </div>
          <div className="pv-stat-value">{counts.awaiting_verification}</div>
          <div className="pv-stat-label">Awaiting Verification</div>
          <div className="pv-stat-sub">Pending review</div>
        </div>

        <div className="pv-stat-card">
          <div className="pv-stat-icon pv-stat-icon--approved">
            <FaCheckCircle />
          </div>
          <div className="pv-stat-value">{counts.approved}</div>
          <div className="pv-stat-label">Approved</div>
          <div className="pv-stat-sub">Approved payments</div>
        </div>

        <div className="pv-stat-card">
          <div className="pv-stat-icon pv-stat-icon--rejected">
            <FaTimesCircle />
          </div>
          <div className="pv-stat-value">{counts.rejected}</div>
          <div className="pv-stat-label">Rejected</div>
          <div className="pv-stat-sub">Rejected payments</div>
        </div>
      </div>

      <div className="pv-panel">
        <div className="pv-toolbar">
          <div className="pv-tabs">
            <button
              type="button"
              className={activeTab === "all" ? "pv-tab pv-tab--active" : "pv-tab"}
              onClick={() => setActiveTab("all")}
            >
              All Orders ({counts.all})
            </button>
            <button
              type="button"
              className={activeTab === "pending" ? "pv-tab pv-tab--active" : "pv-tab"}
              onClick={() => setActiveTab("pending")}
            >
              Pending ({counts.awaiting_verification})
            </button>
            <button
              type="button"
              className={activeTab === "approved" ? "pv-tab pv-tab--active" : "pv-tab"}
              onClick={() => setActiveTab("approved")}
            >
              Approved ({counts.approved})
            </button>
            <button
              type="button"
              className={activeTab === "rejected" ? "pv-tab pv-tab--active" : "pv-tab"}
              onClick={() => setActiveTab("rejected")}
            >
              Rejected ({counts.rejected})
            </button>
          </div>

          <div className="pv-search">
            <FaSearch />
            <input
              type="text"
              placeholder="Search order ID, student name or email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="pv-empty">Loading payment orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="pv-empty">
            <h3>No payments found</h3>
            <p>
              {orders.length === 0
                ? "Student payment slips will appear here after they are submitted."
                : "Try a different search term or switch tabs."}
            </p>
          </div>
        ) : (
          <div className="pv-table-wrap">
            <table className="pv-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order ID</th>
                  <th>Student</th>
                  <th>Courses</th>
                  <th>Amount</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map((order, index) => {
                  const status = getOrderStatus(order);
                  const meta = STATUS_META[status] || STATUS_META.awaiting_verification;
                  const initial = (order.student?.name || "?").charAt(0).toUpperCase();

                  return (
                    <tr key={order._id}>
                      <td>{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="pv-cell-order">{order.orderReference}</td>
                      <td>
                        <div className="pv-student-cell">
                          <span className="pv-avatar">{initial}</span>
                          <div>
                            <div className="pv-student-name">
                              {order.student?.name || "Unknown student"}
                            </div>
                            <div className="pv-student-email">
                              {order.student?.email || "Unknown email"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{coursesSummary(order)}</td>
                      <td>{formatPrice(order.totalAmount)}</td>
                      <td>{formatDate(order.submittedAt)}</td>
                      <td>
                        <span className={`pv-badge ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pv-review-btn"
                          onClick={() => openOrder(order)}
                        >
                          <FaEye />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredOrders.length > 0 && (
          <div className="pv-pagination">
            <span>
              Showing {pageOrders.length} of {filteredOrders.length} order
              {filteredOrders.length === 1 ? "" : "s"}
            </span>

            <div className="pv-page-buttons">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage === 1}
                aria-label="Previous page"
              >
                <FaChevronLeft />
              </button>

              <span className="pv-page-current">{safePage}</span>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(pageCount, page + 1))
                }
                disabled={safePage === pageCount}
                aria-label="Next page"
              >
                <FaChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <>
          <div className="pv-scrim" onClick={closeOrder} />

          <aside className="pv-side-panel">
            <div className="pv-side-header">
              <h3>Order Details</h3>
              <button type="button" onClick={closeOrder} aria-label="Close">
                <FaTimes />
              </button>
            </div>

            <div className="pv-side-body">
              <div className="pv-side-row">
                <span className="pv-side-label">Order ID</span>
                <div className="pv-side-value-with-action">
                  <span>{selectedOrder.orderReference}</span>
                  <button
                    type="button"
                    className="pv-copy-btn"
                    onClick={() => copyOrderReference(selectedOrder.orderReference)}
                    aria-label="Copy order ID"
                  >
                    <FaCopy />
                  </button>
                  {copied && <span className="pv-copied-tag">Copied</span>}
                </div>
              </div>

              <div className="pv-side-row">
                <span className="pv-side-label">Student</span>
                <div>
                  <div className="pv-side-primary">
                    {selectedOrder.student?.name || "Unknown"}
                  </div>
                  <div className="pv-side-secondary">
                    {selectedOrder.student?.email || "Unknown"}
                  </div>
                </div>
              </div>

              <div className="pv-side-row">
                <span className="pv-side-label">Submitted At</span>
                <span>{formatDate(selectedOrder.submittedAt)}</span>
              </div>

              <div className="pv-side-row">
                <span className="pv-side-label">Amount</span>
                <span className="pv-side-amount">
                  {formatPrice(selectedOrder.totalAmount)}
                </span>
              </div>

              <div className="pv-side-row">
                <span className="pv-side-label">Status</span>
                {selectedStatusMeta && (
                  <span className={`pv-badge ${selectedStatusMeta.className}`}>
                    {selectedStatusMeta.label}
                  </span>
                )}
              </div>

              <div className="pv-side-section">
                <h4>Courses</h4>

                {selectedOrder.items?.map((item, index) => (
                  <div className="pv-course-row" key={`${selectedOrder._id}-detail-${index}`}>
                    <div>
                      <span
                        className={
                          item.course?.name
                            ? "pv-course-name"
                            : "pv-badge pv-badge--pending"
                        }
                      >
                        {item.course?.name || "Course unavailable"}
                      </span>

                      {!item.course?.name && (
                        <p className="pv-course-note">
                          This course may have been removed or is no longer
                          available.
                        </p>
                      )}
                    </div>

                    <strong>{formatPrice(item.price)}</strong>
                  </div>
                ))}
              </div>

              <div className="pv-side-section">
                <h4>Payment Slip</h4>

                {slipLoading ? (
                  <div className="pv-slip-box pv-slip-box--message">
                    Loading payment slip...
                  </div>
                ) : slipUrl ? (
                  <div className="pv-slip-box">
                    {selectedOrder.paymentSlip?.mimeType === "application/pdf" ? (
                      <iframe src={slipUrl} title="Payment slip" />
                    ) : (
                      <img src={slipUrl} alt="Student payment slip" />
                    )}
                  </div>
                ) : (
                  <div className="pv-slip-box pv-slip-box--empty">
                    <FaImage />
                    <span>No image available</span>
                  </div>
                )}
              </div>

              <div className="pv-side-section">
                <div className="pv-reason-header">
                  <h4>Rejection Reason (optional)</h4>
                  <span className="pv-reason-count">
                    {rejectionReason.length}/1000
                  </span>
                </div>

                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Enter reason for rejection..."
                />
              </div>
            </div>

            <div className="pv-side-actions">
              <button
                type="button"
                className="pv-btn-approve"
                onClick={() => approveOrder(selectedOrder._id)}
                disabled={processingId === selectedOrder._id}
              >
                <FaCheck />
                {processingId === selectedOrder._id
                  ? "Processing..."
                  : "Approve Payment"}
              </button>

              <button
                type="button"
                className="pv-btn-reject"
                onClick={() => rejectOrder(selectedOrder._id)}
                disabled={
                  processingId === selectedOrder._id || !rejectionReason.trim()
                }
              >
                <FaTimes />
                {processingId === selectedOrder._id
                  ? "Rejecting..."
                  : "Reject Payment"}
              </button>
            </div>
          </aside>
        </>
      )}
      </div>
    </AdminLayout>
  );
}

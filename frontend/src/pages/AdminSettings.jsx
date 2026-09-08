import { useCallback, useEffect, useState } from "react";
import {
  FaBullhorn,
  FaHistory,
  FaPlus,
  FaQrcode,
  FaSave,
  FaTimes,
  FaTrash,
  FaUpload,
} from "react-icons/fa";

import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import { API_ROOT } from "../utils/courseApi";

import "../styles/AdminLayout.css";

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [audit, setAudit] = useState([]);

  const [paymentSettings, setPaymentSettings] = useState({
    receiverName: "",
    paymentMethod: "",
    accountName: "",
    accountNumber: "",
    isActive: true,
  });

  const [qrPreview, setQrPreview] = useState("");
  const [qrFile, setQrFile] = useState(null);

  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  const [announcementOpen, setAnnouncementOpen] = useState(false);

  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    audience: "All Users",
  });

  const [announcementCount, setAnnouncementCount] = useState(5);
  const [auditCount, setAuditCount] = useState(5);

  // --------------------------------------------------
  // Authentication helper
  // --------------------------------------------------

  const getToken = () => localStorage.getItem("token");

  // --------------------------------------------------
  // Load all admin settings
  // --------------------------------------------------

  const load = useCallback(() => Promise.all([
        adminApi("/settings"),
        adminApi("/announcements"),
        adminApi("/audit"),
        adminApi("/payment-settings"),
      ]).then(([config, notices, activity, payment]) => {
      setSettings(config);
      setAnnouncements(notices);
      setAudit(activity);

      const paymentData = payment?.settings || payment || {};
      setPaymentSettings({
        receiverName: paymentData.receiverName || "",
        paymentMethod: paymentData.paymentMethod || "",
        accountName: paymentData.accountName || "",
        accountNumber: paymentData.accountNumber || "",
        isActive: paymentData.isActive ?? true,
      });
    }).catch((error) => {
      setMessage(error.message || "Unable to load settings.");
    }), []);

  useEffect(() => {
    load();
  }, [load]);

  // --------------------------------------------------
  // Load QR preview
  // --------------------------------------------------

  const loadQrPreview = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return Promise.resolve();

    return fetch(`${API_ROOT}/admin/payment-settings/qr`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          setQrPreview("");
          return;
        }
        const blob = await response.blob();
        setQrPreview(URL.createObjectURL(blob));
      })
      .catch((error) => {
        console.error("Load QR preview error:", error);
        setQrPreview("");
      });
  }, []);

  useEffect(() => {
    loadQrPreview();
  }, [loadQrPreview]);

  useEffect(() => {
    return () => {
      if (qrPreview) URL.revokeObjectURL(qrPreview);
    };
  }, [qrPreview]);

  // --------------------------------------------------
  // Save platform settings
  // --------------------------------------------------

  const save = async () => {
    if (
      settings.maxEnrollment < 1 ||
      settings.minPassScore < 0 ||
      settings.minPassScore > 100 ||
      settings.sessionTimeout < 1 ||
      settings.maxLoginAttempts < 1
    ) {
      setMessage("Check the policy values before saving.");
      return;
    }

    setSaving(true);

    try {
      setSettings(
        await adminApi("/settings", {
          method: "PATCH",
          body: JSON.stringify(settings),
        })
      );

      setMessage("Platform settings saved successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // Save payment settings
  // --------------------------------------------------

  const savePaymentSettings = async () => {
    setSavingPayment(true);
    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("You are not logged in.");
      }

      const response = await fetch(
        `${API_ROOT}/admin/payment-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(paymentSettings),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to save payment settings."
        );
      }

      const paymentData = data.settings || data;
      setPaymentSettings({
        receiverName: paymentData.receiverName || "",
        paymentMethod: paymentData.paymentMethod || "",
        accountName: paymentData.accountName || "",
        accountNumber: paymentData.accountNumber || "",
        isActive: paymentData.isActive ?? true,
      });

      setMessage("Payment settings saved successfully.");
    } catch (error) {
      setMessage(
        error.message || "Unable to save payment settings."
      );
    } finally {
      setSavingPayment(false);
    }
  };

  // --------------------------------------------------
  // Select QR file
  // --------------------------------------------------

  const handleQrFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setQrFile(null);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("QR code must be JPG, PNG, or WEBP.");
      event.target.value = "";
      setQrFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("QR code must be smaller than 5 MB.");
      event.target.value = "";
      setQrFile(null);
      return;
    }

    setQrFile(file);
    setMessage("");
  };

  // --------------------------------------------------
  // Upload QR code
  // --------------------------------------------------

  const uploadQr = async () => {
    if (!qrFile) {
      setMessage("Please choose a QR code image first.");
      return;
    }

    setUploadingQr(true);
    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("You are not logged in.");
      }

      const formData = new FormData();
      formData.append("qrCode", qrFile);

      const response = await fetch(
        `${API_ROOT}/admin/payment-settings/qr`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to upload QR code."
        );
      }

      setQrFile(null);

      const fileInput = document.getElementById(
        "payment-qr-upload"
      );

      if (fileInput) {
        fileInput.value = "";
      }

      await loadQrPreview();

      setMessage("Payment QR code uploaded successfully.");
    } catch (error) {
      setMessage(
        error.message || "Unable to upload QR code."
      );
    } finally {
      setUploadingQr(false);
    }
  };

  // --------------------------------------------------
  // Categories
  // --------------------------------------------------

  const addCategory = () => {
    const value = category.trim();

    if (!value) {
      return;
    }

    if (
      settings.categories.some(
        (item) => item.toLowerCase() === value.toLowerCase()
      )
    ) {
      setMessage("That category already exists.");
      return;
    }

    setSettings({
      ...settings,
      categories: [...settings.categories, value],
    });

    setCategory("");
  };

  // --------------------------------------------------
  // Announcements
  // --------------------------------------------------

  const createAnnouncement = async (event) => {
    event.preventDefault();

    if (!announcementForm.title.trim()) {
      return;
    }

    try {
      await adminApi("/announcements", {
        method: "POST",
        body: JSON.stringify({
          ...announcementForm,
          title: announcementForm.title.trim(),
        }),
      });

      setAnnouncementOpen(false);

      setAnnouncementForm({
        title: "",
        audience: "All Users",
      });

      await load();

      setMessage("Announcement published.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const removeAnnouncement = async (id) => {
    if (!window.confirm("Delete this announcement?")) {
      return;
    }

    try {
      await adminApi(`/announcements/${id}`, {
        method: "DELETE",
      });

      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (!settings) {
    return (
      <AdminLayout title="Platform Settings">
        <div className="adm-card">
          {message || "Loading settings..."}
        </div>
      </AdminLayout>
    );
  }

  const updateNumber = (key, value) =>
    setSettings({
      ...settings,
      [key]: Number(value),
    });

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <AdminLayout title="Platform Settings">
      {message && (
        <div className="adm-card adm-settings-message">
          {message}
        </div>
      )}

      {/* --------------------------------------------------
          Learning & Enrollment
      -------------------------------------------------- */}

      <section className="adm-card">
        <header className="adm-card-hdr">
          <div>
            <span className="adm-card-title">
              Learning & Enrollment
            </span>

            <p className="adm-muted">
              Control course capacity, completion requirements,
              and enrollment access.
            </p>
          </div>

          <button
            className="adm-btn adm-btn-primary"
            disabled={saving}
            onClick={save}
          >
            <FaSave />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </header>

        <div className="adm-settings-grid">
          <label className="adm-setting-field">
            <span>Students per course</span>

            <small>
              Maximum number of students allowed in one course.
            </small>

            <input
              className="adm-input"
              type="number"
              min="1"
              value={settings.maxEnrollment}
              onChange={(event) =>
                updateNumber(
                  "maxEnrollment",
                  event.target.value
                )
              }
            />
          </label>

          <label className="adm-setting-field">
            <span>Passing score (%)</span>

            <small>
              Minimum score required to pass assessments.
            </small>

            <input
              className="adm-input"
              type="number"
              min="0"
              max="100"
              value={settings.minPassScore}
              onChange={(event) =>
                updateNumber(
                  "minPassScore",
                  event.target.value
                )
              }
            />
          </label>
        </div>

        <div className="adm-toggle-list">
          <label>
            <div>
              <strong>Require course approval</strong>

              <small>
                Only admin-approved courses can accept enrollment.
              </small>
            </div>

            <input
              type="checkbox"
              checked={settings.approvalRequired}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  approvalRequired: event.target.checked,
                })
              }
            />
          </label>

          <label>
            <div>
              <strong>Allow student self-enrollment</strong>

              <small>
                Students can enroll without manual admin approval.
              </small>
            </div>

            <input
              type="checkbox"
              checked={settings.allowSelfEnroll}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  allowSelfEnroll: event.target.checked,
                })
              }
            />
          </label>
        </div>
      </section>

      {/* --------------------------------------------------
          Manual QR Payment
      -------------------------------------------------- */}

      <section className="adm-card">
        <header className="adm-card-hdr">
          <div>
            <span className="adm-card-title">
              <FaQrcode /> Manual QR Payment
            </span>

            <p className="adm-muted">
              Configure the bank/payment information students
              will see when they purchase a paid course.
            </p>
          </div>

          <button
            className="adm-btn adm-btn-primary"
            disabled={savingPayment}
            onClick={savePaymentSettings}
          >
            <FaSave />
            {savingPayment
              ? "Saving..."
              : "Save Payment Settings"}
          </button>
        </header>

        <div className="adm-settings-grid">
          <label className="adm-setting-field">
            <span>Receiver Name</span>

            <small>
              Name displayed to students on the payment page.
            </small>

            <input
              className="adm-input"
              type="text"
              value={paymentSettings.receiverName}
              onChange={(event) =>
                setPaymentSettings({
                  ...paymentSettings,
                  receiverName: event.target.value,
                })
              }
              placeholder="Example: EDUNOVA COMPANY"
            />
          </label>

          <label className="adm-setting-field">
            <span>Payment Method</span>

            <small>
              Bank or payment service used to receive the transfer.
            </small>

            <input
              className="adm-input"
              type="text"
              value={paymentSettings.paymentMethod}
              onChange={(event) =>
                setPaymentSettings({
                  ...paymentSettings,
                  paymentMethod: event.target.value,
                })
              }
              placeholder="Example: PromptPay"
            />
          </label>

          <label className="adm-setting-field">
            <span>Account Name</span>

            <small>
              Name registered on the receiving account.
            </small>

            <input
              className="adm-input"
              type="text"
              value={paymentSettings.accountName}
              onChange={(event) =>
                setPaymentSettings({
                  ...paymentSettings,
                  accountName: event.target.value,
                })
              }
              placeholder="Example: EDUNOVA"
            />
          </label>

          <label className="adm-setting-field">
            <span>Account Number</span>

            <small>
              Receiving account number or PromptPay number.
            </small>

            <input
              className="adm-input"
              type="text"
              value={paymentSettings.accountNumber}
              onChange={(event) =>
                setPaymentSettings({
                  ...paymentSettings,
                  accountNumber: event.target.value,
                })
              }
              placeholder="Enter account number"
            />
          </label>
        </div>

        <div className="adm-toggle-list">
          <label>
            <div>
              <strong>Enable manual QR payment</strong>

              <small>
                Students can use this payment method when
                purchasing paid courses.
              </small>
            </div>

            <input
              type="checkbox"
              checked={paymentSettings.isActive}
              onChange={(event) =>
                setPaymentSettings({
                  ...paymentSettings,
                  isActive: event.target.checked,
                })
              }
            />
          </label>
        </div>

        {/* QR upload */}

        <div
          style={{
            marginTop: "24px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <strong
              style={{
                display: "block",
                marginBottom: "6px",
              }}
            >
              Payment QR Code
            </strong>

            <small className="adm-muted">
              Upload the QR code students should scan to make
              the bank transfer. JPG, PNG, or WEBP — maximum 5 MB.
            </small>
          </div>

          {qrPreview && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                marginBottom: "18px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: "220px",
                  height: "220px",
                  background: "#fff",
                  borderRadius: "12px",
                  padding: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={qrPreview}
                  alt="Current payment QR code"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>

              <div>
                <strong>Current QR Code</strong>

                <p
                  className="adm-muted"
                  style={{ marginTop: "6px" }}
                >
                  This is the QR code currently shown to
                  students.
                </p>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label
              htmlFor="payment-qr-upload"
              className="adm-btn adm-btn-secondary"
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaUpload />
              Choose QR Image
            </label>

            <input
              id="payment-qr-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleQrFileChange}
              style={{ display: "none" }}
            />

            {qrFile && (
              <span className="adm-muted">
                {qrFile.name}
              </span>
            )}

            <button
              type="button"
              className="adm-btn adm-btn-primary"
              disabled={!qrFile || uploadingQr}
              onClick={uploadQr}
            >
              <FaUpload />
              {uploadingQr ? "Uploading..." : "Upload QR"}
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------
          Security
      -------------------------------------------------- */}

      <section className="adm-card">
        <header className="adm-card-hdr">
          <div>
            <span className="adm-card-title">
              Security
            </span>

            <p className="adm-muted">
              These settings are enforced during login.
            </p>
          </div>
        </header>

        <div className="adm-settings-grid">
          <label className="adm-setting-field">
            <span>Session timeout (minutes)</span>

            <small>
              Users must log in again when the session expires.
            </small>

            <input
              className="adm-input"
              type="number"
              min="1"
              value={settings.sessionTimeout}
              onChange={(event) =>
                updateNumber(
                  "sessionTimeout",
                  event.target.value
                )
              }
            />
          </label>

          <label className="adm-setting-field">
            <span>Maximum login attempts</span>

            <small>
              Account login is paused for 5 minutes after this
              limit.
            </small>

            <input
              className="adm-input"
              type="number"
              min="1"
              value={settings.maxLoginAttempts}
              onChange={(event) =>
                updateNumber(
                  "maxLoginAttempts",
                  event.target.value
                )
              }
            />
          </label>
        </div>
      </section>

      {/* --------------------------------------------------
          Course Categories
      -------------------------------------------------- */}

      <section className="adm-card">
        <header className="adm-card-hdr">
          <div>
            <span className="adm-card-title">
              Course Categories
            </span>

            <p className="adm-muted">
              Keep course discovery organized with reusable
              categories.
            </p>
          </div>
        </header>

        <div className="adm-category-add">
          <input
            className="adm-input"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addCategory();
              }
            }}
            placeholder="Enter a category name"
          />

          <button
            className="adm-btn adm-btn-primary"
            onClick={addCategory}
          >
            <FaPlus />
            Add Category
          </button>
        </div>

        <div className="adm-category-list">
          {settings.categories.map((item) => (
            <span key={item}>
              {item}

              <button
                aria-label={`Remove ${item}`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    categories: settings.categories.filter(
                      (value) => value !== item
                    ),
                  })
                }
              >
                <FaTimes />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------
          Announcements
      -------------------------------------------------- */}

      <section className="adm-card">
        <header className="adm-card-hdr">
          <div>
            <span className="adm-card-title">
              <FaBullhorn /> Announcements
            </span>

            <p className="adm-muted">
              Publish important platform messages to a selected
              audience.
            </p>
          </div>

          <button
            className="adm-btn adm-btn-primary"
            onClick={() => setAnnouncementOpen(true)}
          >
            <FaPlus />
            New Announcement
          </button>
        </header>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Announcement</th>
                <th>Audience</th>
                <th>Published</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {announcements
                .slice(0, announcementCount)
                .map((item) => (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.title}</strong>
                    </td>

                    <td>{item.audience}</td>

                    <td className="adm-muted">
                      {formatAdminDate(item.createdAt)}
                    </td>

                    <td>
                      <button
                        className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() =>
                          removeAnnouncement(item._id)
                        }
                      >
                        <FaTrash />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!announcements.length && (
          <p className="adm-empty">
            No announcements have been published.
          </p>
        )}

        <AdminListControls
          total={announcements.length}
          visible={announcementCount}
          onChange={setAnnouncementCount}
        />
      </section>

      {/* --------------------------------------------------
          Audit Log
      -------------------------------------------------- */}

      <section className="adm-card">
        <header className="adm-card-hdr">
          <div>
            <span className="adm-card-title">
              <FaHistory /> Audit Log
            </span>

            <p className="adm-muted">
              A permanent history of important admin actions.
            </p>
          </div>
        </header>

        {audit.slice(0, auditCount).map((item) => (
          <article
            className="adm-activity-item"
            key={item._id}
          >
            <div>
              <strong className="adm-activity-action">
                {item.action}
              </strong>

              <p className="adm-activity-detail">
                {item.detail} · {item.admin?.name || "Admin"}
              </p>

              <small className="adm-activity-time">
                {formatAdminDate(item.createdAt)}
              </small>
            </div>
          </article>
        ))}

        {!audit.length && (
          <p className="adm-empty">
            No admin activity has been recorded.
          </p>
        )}

        <AdminListControls
          total={audit.length}
          visible={auditCount}
          onChange={setAuditCount}
        />
      </section>

      {/* --------------------------------------------------
          Announcement Modal
      -------------------------------------------------- */}

      {announcementOpen && (
        <div
          className="adm-modal-overlay"
          role="presentation"
          onMouseDown={() =>
            setAnnouncementOpen(false)
          }
        >
          <form
            className="adm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-title"
            onSubmit={createAnnouncement}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <h2
              className="adm-modal-title"
              id="announcement-title"
            >
              New Announcement
            </h2>

            <p className="adm-modal-description">
              Create a short message for users across EDUNOVA.
            </p>

            <label className="adm-field">
              <span className="adm-label">
                Message
              </span>

              <textarea
                className="adm-input adm-announcement-input"
                required
                maxLength="300"
                value={announcementForm.title}
                onChange={(event) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    title: event.target.value,
                  })
                }
                placeholder="Write the announcement"
              />
            </label>

            <label className="adm-field">
              <span className="adm-label">
                Audience
              </span>

              <select
                className="adm-input"
                value={announcementForm.audience}
                onChange={(event) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    audience: event.target.value,
                  })
                }
              >
                <option>All Users</option>
                <option>Students</option>
                <option>Tutors</option>
              </select>
            </label>

            <div className="adm-modal-footer">
              <button
                className="adm-btn adm-btn-secondary"
                type="button"
                onClick={() =>
                  setAnnouncementOpen(false)
                }
              >
                Cancel
              </button>

              <button
                className="adm-btn adm-btn-primary"
                type="submit"
              >
                Publish
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
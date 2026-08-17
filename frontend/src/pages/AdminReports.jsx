import { useEffect, useMemo, useState } from "react";
import { FaDownload, FaEye, FaSearch, FaTimes } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import AdminListControls from "../components/AdminListControls";
import { adminApi, formatAdminDate } from "../utils/adminApi";
import "../styles/AdminLayout.css";

const STATUSES = ["pending", "reviewing", "resolved", "dismissed"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

export default function AdminReports() {
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [visibleCount, setVisibleCount] = useState(5);
  const [selectedReport, setSelectedReport] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterReferenceTime] = useState(() => Date.now());

  const load = () => Promise.all([adminApi("/overview"), adminApi("/reports")])
    .then(([stats, items]) => { setOverview(stats); setReports(items); })
    .catch((requestError) => setError(requestError.message));

  useEffect(() => { load(); }, []);

  const filteredReports = useMemo(() => reports.filter((report) => {
    const text = `${report.type} ${report.detail} ${report.course?.name || ""} ${report.reporter?.name || ""} ${report.targetUser?.name || ""}`.toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    const matchesStatus = status === "all" || report.status === status;
    const matchesPriority = priority === "all" || (report.priority || "medium") === priority;
    const age = filterReferenceTime - new Date(report.createdAt).getTime();
    const matchesDate = dateRange === "all" || age <= Number(dateRange) * 86400000;
    return matchesSearch && matchesStatus && matchesPriority && matchesDate;
  }), [dateRange, filterReferenceTime, priority, reports, search, status]);

  const openReport = (report) => {
    setSelectedReport(report);
    setAdminNote(report.adminNote || "");
  };

  const updateReport = async (nextStatus) => {
    if (!selectedReport) return;
    setSaving(true);
    try {
      const updated = await adminApi(`/reports/${selectedReport._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, priority: selectedReport.priority || "medium", adminNote }),
      });
      setReports((items) => items.map((item) => item._id === updated._id ? updated : item));
      setSelectedReport(updated);
      setAdminNote(updated.adminNote || "");
      setError("Report updated successfully.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  const updatePriority = (value) => {
    setSelectedReport((report) => ({ ...report, priority: value }));
  };

  const exportData = () => {
    const rows = [["Type", "Priority", "Course", "About", "Reporter", "Status", "Created"], ...filteredReports.map((report) => [report.type, report.priority || "medium", report.course?.name || "", report.targetUser?.name || "", report.reporter?.name || "", report.status, report.createdAt])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "edunova-reports.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const completionRate = overview?.enrollments ? Math.round((overview.completedCourses / overview.enrollments) * 100) : 0;

  return (
    <AdminLayout title="Reports & Analytics">
      {error && <div className="adm-card">{error}</div>}
      {overview && <div className="adm-stats-grid">{[
        ["Total Users", overview.students + overview.tutors],
        ["Enrollments", overview.enrollments],
        ["Completion Rate", `${completionRate}%`],
        ["Study Hours", Math.round(overview.totalStudySeconds / 3600)],
      ].map(([label, value]) => <article className="adm-stat-card" style={{ "--accent": "#8d63ea" }} key={label}><div><strong className="adm-stat-value">{value}</strong><p className="adm-stat-label">{label}</p></div></article>)}</div>}

      <section className="adm-card">
        <div className="adm-card-hdr"><div><span className="adm-card-title">Submitted Reports</span><p className="adm-muted">{reports.filter((report) => report.status === "pending").length} pending review</p></div><button className="adm-btn adm-btn-primary" onClick={exportData}><FaDownload /> Export CSV</button></div>
        <div className="adm-report-filters">
          <label className="adm-search-box"><FaSearch /><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(5); }} placeholder="Search reports" /></label>
          <select className="adm-select" value={status} onChange={(event) => { setStatus(event.target.value); setVisibleCount(5); }}><option value="all">All statuses</option>{STATUSES.map((item) => <option value={item} key={item}>{item}</option>)}</select>
          <select className="adm-select" value={priority} onChange={(event) => { setPriority(event.target.value); setVisibleCount(5); }}><option value="all">All priorities</option>{PRIORITIES.map((item) => <option value={item} key={item}>{item}</option>)}</select>
          <select className="adm-select" value={dateRange} onChange={(event) => { setDateRange(event.target.value); setVisibleCount(5); }}><option value="all">Any date</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
        </div>
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Report</th><th>About</th><th>Reporter</th><th>Priority</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{filteredReports.slice(0, visibleCount).map((report) => <tr key={report._id}><td><strong>{report.type}</strong><div className="adm-muted">{report.detail}</div></td><td>{report.course?.name || report.targetUser?.name || "Platform"}</td><td>{report.reporter?.name || "Anonymous"}</td><td><span className={`adm-status-pill pill-${report.priority || "medium"}`}>{report.priority || "medium"}</span></td><td><span className={`adm-status-pill pill-${report.status}`}>{report.status}</span></td><td className="adm-muted">{formatAdminDate(report.createdAt)}</td><td><button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => openReport(report)}><FaEye /> Review</button></td></tr>)}</tbody></table></div>
        {!filteredReports.length && <p className="adm-empty">No reports match these filters.</p>}
        <AdminListControls total={filteredReports.length} visible={visibleCount} onChange={setVisibleCount} />
      </section>

      {selectedReport && <div className="adm-modal-backdrop" role="presentation" onMouseDown={() => setSelectedReport(null)}><section className="adm-review-modal adm-report-modal" role="dialog" aria-modal="true" aria-labelledby="report-review-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="adm-review-header"><div><span>REPORT REVIEW</span><h2 id="report-review-title">{selectedReport.type}</h2><p>Submitted {formatAdminDate(selectedReport.createdAt)}</p></div><button className="adm-modal-close" aria-label="Close report" onClick={() => setSelectedReport(null)}><FaTimes /></button></header>
        <div className="adm-review-summary"><div><small>Reporter</small><strong>{selectedReport.reporter?.name || "Anonymous"}</strong></div><div><small>About</small><strong>{selectedReport.course?.name || selectedReport.targetUser?.name || "Platform"}</strong></div><div><small>Status</small><strong>{selectedReport.status}</strong></div><div><small>Priority</small><strong>{selectedReport.priority || "medium"}</strong></div></div>
        <div className="adm-report-detail"><h3>Report details</h3><p>{selectedReport.detail}</p></div>
        <div className="adm-report-review-form"><label className="adm-field"><span className="adm-label">Priority</span><select className="adm-input" value={selectedReport.priority || "medium"} onChange={(event) => updatePriority(event.target.value)}>{PRIORITIES.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label className="adm-field"><span className="adm-label">Admin note</span><textarea className="adm-input adm-report-note" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Record your review decision or follow-up details" /></label></div>
        <footer className="adm-review-actions"><button className="adm-btn adm-btn-secondary" disabled={saving} onClick={() => updateReport("reviewing")}>Mark Reviewing</button><button className="adm-btn adm-btn-danger" disabled={saving} onClick={() => updateReport("dismissed")}>Dismiss</button><button className="adm-btn adm-btn-success" disabled={saving} onClick={() => updateReport("resolved")}>{saving ? "Saving..." : "Resolve"}</button></footer>
      </section></div>}
    </AdminLayout>
  );
}

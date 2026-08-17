export default function AdminListControls({ total, visible, onChange }) {
  if (total <= 5) return null;
  return (
    <div className="adm-activity-controls">
      {visible < total && <button className="adm-btn adm-btn-secondary" onClick={() => onChange(visible + 5)}>See More</button>}
      {visible > 5 && <button className="adm-btn adm-btn-secondary" onClick={() => onChange(5)}>Show Less</button>}
    </div>
  );
}

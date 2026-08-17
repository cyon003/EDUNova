import { useState } from "react";
import { FaSearch, FaEye, FaKey, FaBan, FaCheck } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import "../styles/AdminLayout.css";

const INIT_STUDENTS = [
  { id:1, name:"Lena Park",     email:"lena@gmail.com",    avatar:"LP", enrolled:4, completed:2, lastActive:"Today",       status:"active"    },
  { id:2, name:"Mia Chen",      email:"mia@gmail.com",     avatar:"MC", enrolled:3, completed:1, lastActive:"Yesterday",   status:"active"    },
  { id:3, name:"Carlos Rivera", email:"carlos@gmail.com",  avatar:"CR", enrolled:2, completed:0, lastActive:"3 days ago",  status:"suspended" },
  { id:4, name:"Ahmed Hassan",  email:"ahmed@gmail.com",   avatar:"AH", enrolled:5, completed:3, lastActive:"Today",       status:"active"    },
  { id:5, name:"Tom Blake",     email:"tom@gmail.com",     avatar:"TB", enrolled:1, completed:0, lastActive:"1 week ago",  status:"active"    },
  { id:6, name:"Diana Ford",    email:"diana@gmail.com",   avatar:"DF", enrolled:6, completed:4, lastActive:"2 days ago",  status:"active"    },
  { id:7, name:"Ken Watanabe",  email:"ken@gmail.com",     avatar:"KW", enrolled:2, completed:1, lastActive:"4 days ago",  status:"active"    },
  { id:8, name:"Sara Lee",      email:"sara.l@gmail.com",  avatar:"SL", enrolled:3, completed:2, lastActive:"Yesterday",   status:"suspended" },
];

export default function AdminStudents() {
  const [students, setStudents] = useState(INIT_STUDENTS);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [tempPass, setTempPass] = useState("");

  const filtered = students.filter(s => {
    const m = s.name.toLowerCase().includes(search.toLowerCase()) ||
              s.email.toLowerCase().includes(search.toLowerCase());
    const f = filter === "all" || s.status === filter;
    return m && f;
  });

  const openView    = (s) => { setSelected(s); setModal("view"); };
  const openReset   = (s) => { setSelected(s); setTempPass(""); setModal("reset"); };
  const openConfirm = (s) => { setSelected(s); setModal("confirm"); };

  const handleToggle = () => {
    setStudents(p => p.map(s => s.id === selected.id
      ? { ...s, status: s.status === "active" ? "suspended" : "active" } : s));
    setModal(null);
  };

  return (
    <AdminLayout title="Student Management" subtitle="Search, view, suspend and manage student accounts.">

      {/* Stats */}
      <div className="adm-stats-grid">
        {[
          { label:"Total Students",  value: students.length,                                   color:"#f0a400" },
          { label:"Active",          value: students.filter(s=>s.status==="active").length,    color:"#34D399" },
          { label:"Suspended",       value: students.filter(s=>s.status==="suspended").length, color:"#F87171" },
          { label:"Avg Enrollments", value: (students.reduce((a,s)=>a+s.enrolled,0)/students.length).toFixed(1), color:"#00D5F7" },
        ].map(s=>(
          <div className="adm-stat-card" key={s.label} style={{"--accent":s.color}}>
            <div>
              <div className="adm-stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="adm-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-card">
        <div className="adm-card-hdr">
          <span className="adm-card-title">All Students</span>
        </div>

        <div className="adm-search-row">
          <div className="adm-search-box">
            <FaSearch className="adm-search-icon"/>
            <input placeholder="Search by name or email…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select className="adm-select" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <table className="adm-table">
          <thead>
            <tr><th>Student</th><th>Enrolled</th><th>Completed</th><th>Last Active</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(s=>(
              <tr key={s.id}>
                <td>
                  <div className="adm-user-cell">
                    <div className="adm-cell-avatar">{s.avatar}</div>
                    <div>
                      <div className="adm-cell-name">{s.name}</div>
                      <div className="adm-cell-email">{s.email}</div>
                    </div>
                  </div>
                </td>
                <td className="adm-muted">{s.enrolled} courses</td>
                <td className="adm-muted">{s.completed} courses</td>
                <td className="adm-muted">{s.lastActive}</td>
                <td><span className={`adm-status-pill pill-${s.status}`}>{s.status}</span></td>
                <td>
                  <div style={{display:"flex",gap:6}}>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openView(s)} title="View"><FaEye/></button>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openReset(s)} title="Reset Password"><FaKey/></button>
                    <button
                      className={`adm-btn adm-btn-sm ${s.status==="active"?"adm-btn-danger":"adm-btn-success"}`}
                      onClick={()=>openConfirm(s)}
                    >
                      {s.status==="active"?<FaBan/>:<FaCheck/>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0&&(
              <tr><td colSpan="6" style={{textAlign:"center",padding:32,color:"rgba(255,255,255,0.3)"}}>No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW */}
      {modal==="view"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Student Profile</div>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:16,background:"rgba(255,255,255,0.05)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)"}}>
              <div className="adm-cell-avatar" style={{width:52,height:52,fontSize:18}}>{selected.avatar}</div>
              <div>
                <div style={{fontSize:18,fontWeight:800,color:"#eff0fb"}}>{selected.name}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>{selected.email}</div>
                <span className={`adm-status-pill pill-${selected.status}`} style={{marginTop:6,display:"inline-block"}}>{selected.status}</span>
              </div>
            </div>
            {[
              ["Enrolled Courses",  selected.enrolled],
              ["Completed Courses", selected.completed],
              ["Last Active",       selected.lastActive],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:600}}>{l}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#eff0fb"}}>{v}</span>
              </div>
            ))}
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* RESET */}
      {modal==="reset"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Reset Password — {selected.name}</div>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:20,lineHeight:1.6}}>
              Generate a temporary password. The student must change it on next login. Passwords are never stored in plain text.
            </p>
            {tempPass
              ? <div style={{background:"rgba(240,164,0,0.08)",border:"1px solid rgba(240,164,0,0.3)",borderRadius:12,padding:"16px 20px",textAlign:"center",marginBottom:16}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Temporary Password</div>
                  <div style={{fontSize:22,fontWeight:800,letterSpacing:4,color:"#f0a400"}}>{tempPass}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:8}}>Copy this now — it won't be shown again.</div>
                </div>
              : <button className="adm-btn adm-btn-primary" style={{width:"100%",justifyContent:"center"}}
                  onClick={()=>setTempPass(Math.random().toString(36).slice(-8).toUpperCase())}>
                  <FaKey/> Generate Temporary Password
                </button>
            }
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM */}
      {modal==="confirm"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">{selected.status==="active"?"Suspend Student":"Reactivate Student"}</div>
            <div className="adm-confirm">
              <p>Are you sure you want to <strong>{selected.status==="active"?"suspend":"reactivate"}</strong> <strong>{selected.name}</strong>?</p>
              <p style={{marginTop:8}}>{selected.status==="active"
                ?"They will lose platform access immediately."
                :"They will regain full student access."
              }</p>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className={`adm-btn ${selected.status==="active"?"adm-btn-danger":"adm-btn-success"}`} onClick={handleToggle}>
                {selected.status==="active"?"Yes, Suspend":"Yes, Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

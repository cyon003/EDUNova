import { useState } from "react";
import { FaSearch, FaPlus, FaEye, FaEdit, FaKey, FaBan, FaCheck } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import "../styles/AdminLayout.css";

const INIT_TUTORS = [
  { id:1, name:"James Okafor",  email:"james@edunova.com",  avatar:"JO", courses:3, students:166, status:"active",    joined:"Jan 12, 2024" },
  { id:2, name:"Sara Müller",   email:"sara@edunova.com",   avatar:"SM", courses:2, students:98,  status:"active",    joined:"Feb 3, 2024"  },
  { id:3, name:"Lena Park",     email:"lena@edunova.com",   avatar:"LP", courses:1, students:40,  status:"pending",   joined:"Mar 20, 2024" },
  { id:4, name:"David Kim",     email:"david@edunova.com",  avatar:"DK", courses:4, students:210, status:"active",    joined:"Nov 5, 2023"  },
  { id:5, name:"Aisha Nwosu",   email:"aisha@edunova.com",  avatar:"AN", courses:0, students:0,   status:"suspended", joined:"Apr 1, 2024"  },
  { id:6, name:"Marco Rossi",   email:"marco@edunova.com",  avatar:"MR", courses:2, students:87,  status:"active",    joined:"Dec 10, 2023" },
];

const INIT_FORM = { name:"", email:"", password:"" };

export default function AdminTutors() {
  const [tutors,   setTutors]   = useState(INIT_TUTORS);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState(INIT_FORM);
  const [editForm, setEditForm] = useState({ name:"", email:"" });
  const [tempPass, setTempPass] = useState("");

  const filtered = tutors.filter(t => {
    const mSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                    t.email.toLowerCase().includes(search.toLowerCase());
    const mFilter = filter === "all" || t.status === filter;
    return mSearch && mFilter;
  });

  const openCreate  = ()  => { setForm(INIT_FORM); setModal("create"); };
  const openView    = (t) => { setSelected(t); setModal("view"); };
  const openEdit    = (t) => { setSelected(t); setEditForm({ name:t.name, email:t.email }); setModal("edit"); };
  const openReset   = (t) => { setSelected(t); setTempPass(""); setModal("reset"); };
  const openConfirm = (t) => { setSelected(t); setModal("confirm"); };

  const handleCreate = () => {
    if (!form.name || !form.email) return;
    setTutors(p => [{
      id: Date.now(),
      name: form.name, email: form.email,
      avatar: form.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(),
      courses:0, students:0, status:"active",
      joined: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
    }, ...p]);
    setModal(null);
  };

  const handleEdit = () => {
    if (!editForm.name || !editForm.email) return;
    setTutors(p => p.map(t => t.id === selected.id ? {
      ...t, name:editForm.name, email:editForm.email,
      avatar: editForm.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(),
    } : t));
    setModal(null);
  };

  const handleToggle = () => {
    setTutors(p => p.map(t => t.id===selected.id
      ? {...t, status: t.status==="active"?"suspended":"active"} : t));
    setModal(null);
  };

  return (
    <AdminLayout title="Tutor Management" subtitle="Create, edit, suspend and manage tutor accounts.">

      {/* Stats */}
      <div className="adm-stats-grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        {[
          { label:"Total Tutors",     value: tutors.length,                                   color:"#f0a400" },
          { label:"Active Tutors",    value: tutors.filter(t=>t.status==="active").length,    color:"#34D399" },
          { label:"Suspended Tutors", value: tutors.filter(t=>t.status==="suspended").length, color:"#F87171" },
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
          <span className="adm-card-title">All Tutors</span>
          <button className="adm-btn adm-btn-primary" onClick={openCreate}><FaPlus/> Create Tutor</button>
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
            <option value="pending">Pending</option>
          </select>
        </div>

        <table className="adm-table">
          <thead>
            <tr><th>Tutor</th><th>Courses</th><th>Students</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(t=>(
              <tr key={t.id}>
                <td>
                  <div className="adm-user-cell">
                    <div className="adm-cell-avatar">{t.avatar}</div>
                    <div>
                      <div className="adm-cell-name">{t.name}</div>
                      <div className="adm-cell-email">{t.email}</div>
                    </div>
                  </div>
                </td>
                <td className="adm-muted">{t.courses}</td>
                <td className="adm-muted">{t.students}</td>
                <td className="adm-muted">{t.joined}</td>
                <td><span className={`adm-status-pill pill-${t.status}`}>{t.status}</span></td>
                <td>
                  <div style={{display:"flex",gap:6}}>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openView(t)} title="View"><FaEye/></button>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openEdit(t)} title="Edit"><FaEdit/></button>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openReset(t)} title="Reset Password"><FaKey/></button>
                    <button
                      className={`adm-btn adm-btn-sm ${t.status==="active"?"adm-btn-danger":"adm-btn-success"}`}
                      onClick={()=>openConfirm(t)}
                    >
                      {t.status==="active"?<FaBan/>:<FaCheck/>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0&&(
              <tr><td colSpan="6" style={{textAlign:"center",padding:32,color:"rgba(255,255,255,0.3)"}}>No tutors found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE */}
      {modal==="create"&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Create Tutor Account</div>
            <div className="adm-field">
              <label className="adm-label">Full Name</label>
              <input className="adm-input" placeholder="e.g. James Okafor" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            </div>
            <div className="adm-field">
              <label className="adm-label">Email Address</label>
              <input className="adm-input" type="email" placeholder="tutor@edunova.com" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
            </div>
            <div className="adm-field">
              <label className="adm-label">Temporary Password</label>
              <input className="adm-input" type="password" placeholder="Min 8 characters" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))}/>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:4}}>Tutor must change this on first login.</div>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="adm-btn adm-btn-primary" onClick={handleCreate}>Create Account</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT */}
      {modal==="edit"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Edit Tutor — {selected.name}</div>
            <div className="adm-field">
              <label className="adm-label">Full Name</label>
              <input className="adm-input" value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}/>
            </div>
            <div className="adm-field">
              <label className="adm-label">Email Address</label>
              <input className="adm-input" type="email" value={editForm.email} onChange={e=>setEditForm(p=>({...p,email:e.target.value}))}/>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",padding:"10px 14px",background:"rgba(255,255,255,0.04)",borderRadius:10,marginBottom:4}}>
              ⚠ To change the password, use the Reset Password option instead.
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="adm-btn adm-btn-primary" onClick={handleEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW */}
      {modal==="view"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Tutor Profile</div>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:16,background:"rgba(255,255,255,0.05)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)"}}>
              <div className="adm-cell-avatar" style={{width:52,height:52,fontSize:18}}>{selected.avatar}</div>
              <div>
                <div style={{fontSize:18,fontWeight:800,color:"#eff0fb"}}>{selected.name}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>{selected.email}</div>
                <span className={`adm-status-pill pill-${selected.status}`} style={{marginTop:6,display:"inline-block"}}>{selected.status}</span>
              </div>
            </div>
            {[["Joined",selected.joined],["Courses Assigned",selected.courses],["Total Students",selected.students]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:600}}>{l}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#eff0fb"}}>{v}</span>
              </div>
            ))}
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Close</button>
              <button className="adm-btn adm-btn-primary" onClick={()=>openEdit(selected)}>Edit Info</button>
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
              Generate a temporary password. The tutor must change it on next login. Passwords are never stored in plain text.
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

      {/* CONFIRM SUSPEND/REACTIVATE */}
      {modal==="confirm"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">{selected.status==="active"?"Suspend Tutor":"Reactivate Tutor"}</div>
            <div className="adm-confirm">
              <p>Are you sure you want to <strong>{selected.status==="active"?"suspend":"reactivate"}</strong> <strong>{selected.name}</strong>?</p>
              <p style={{marginTop:8}}>{selected.status==="active"?"They will lose platform access immediately.":"They will regain full tutor access."}</p>
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

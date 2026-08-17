import { useState } from "react";
import { FaPlus, FaTrash, FaCheck, FaBan, FaFlag, FaHistory, FaCog, FaBullhorn } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import "../styles/AdminLayout.css";

const INIT_ANNOUNCEMENTS = [
  { id:1, title:"Platform maintenance on Saturday",    audience:"All Users", date:"Aug 10, 2025", status:"active"  },
  { id:2, title:"New AI Tutor feature now available",  audience:"Students",  date:"Aug 5, 2025",  status:"active"  },
  { id:3, title:"Tutor onboarding webinar this Friday",audience:"Tutors",    date:"Jul 28, 2025", status:"expired" },
];

const INIT_REPORTS = [
  { id:1, type:"Inappropriate Content", course:"Python Basics",      reporter:"Mia Chen",    detail:"Lesson 3 contains offensive language.",          status:"pending",   date:"Today"      },
  { id:2, type:"Plagiarism",            course:"UI/UX Masterclass",  reporter:"Tom Blake",   detail:"Assignment solution copied from Stack Overflow.", status:"pending",   date:"Yesterday"  },
  { id:3, type:"Incorrect Information", course:"Data Science Intro", reporter:"Sara Lee",    detail:"Formula in Module 2 is mathematically wrong.",   status:"resolved",  date:"3 days ago" },
  { id:4, type:"Spam",                  course:"React Fundamentals", reporter:"Ahmed Hassan",detail:"Tutor posting unrelated ads in announcements.",   status:"dismissed", date:"1 week ago" },
];

const AUDIT_LOG = [
  { action:"Tutor account created",     detail:"James Okafor added by Admin",               time:"Today, 09:14",     icon:"👨‍🏫", color:"#00D5F7" },
  { action:"Course approved",           detail:"Python Basics approved for publishing",      time:"Today, 08:52",     icon:"✅", color:"#34D399" },
  { action:"Student suspended",         detail:"Carlos Rivera suspended by Admin",           time:"Yesterday, 18:11", icon:"🚫", color:"#F87171" },
  { action:"Password reset",            detail:"Temp password issued for Mia Chen",         time:"Yesterday, 15:30", icon:"🔑", color:"#A78BFA" },
  { action:"Announcement posted",       detail:"Platform maintenance notice published",     time:"Aug 10, 14:00",    icon:"📢", color:"#f0a400" },
  { action:"Course archived",           detail:"Intro to Java archived (90 days inactive)", time:"Aug 9, 11:20",     icon:"📦", color:"rgba(255,255,255,0.4)" },
  { action:"Reported content reviewed", detail:"Plagiarism report on UI/UX dismissed",     time:"Aug 8, 09:00",     icon:"🚩", color:"#F87171" },
  { action:"Policy updated",            detail:"Max course size changed from 100 to 150",   time:"Aug 7, 16:45",     icon:"⚙",  color:"#f0a400" },
];

const INIT_POLICIES = {
  maxEnrollment:    "150",
  minPassScore:     "60",
  approvalRequired: true,
  allowSelfEnroll:  true,
  sessionTimeout:   "30",
  maxLoginAttempts: "5",
};

const TABS = [
  { key:"announcements", label:"Announcements",    icon:<FaBullhorn/> },
  { key:"policies",      label:"Policies",         icon:<FaCog/>      },
  { key:"reported",      label:"Reported Content", icon:<FaFlag/>     },
  { key:"audit",         label:"Audit Log",        icon:<FaHistory/>  },
];

export default function AdminSettings() {
  const [tab,           setTab]           = useState("announcements");
  const [announcements, setAnnouncements] = useState(INIT_ANNOUNCEMENTS);
  const [reports,       setReports]       = useState(INIT_REPORTS);
  const [policies,      setPolicies]      = useState(INIT_POLICIES);
  const [modal,         setModal]         = useState(null);
  const [newAnn,        setNewAnn]        = useState({ title:"", audience:"All Users" });
  const [policySaved,   setPolicySaved]   = useState(false);
  const [selected,      setSelected]      = useState(null);

  const handleDeleteAnn = (id) => setAnnouncements(p=>p.filter(a=>a.id!==id));

  const handleAddAnn = () => {
    if (!newAnn.title) return;
    setAnnouncements(p=>[{
      id:Date.now(), title:newAnn.title, audience:newAnn.audience,
      date: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      status:"active"
    },...p]);
    setNewAnn({title:"",audience:"All Users"});
    setModal(null);
  };

  const handleReportAction = (id, action) =>
    setReports(p=>p.map(r=>r.id===id?{...r,status:action}:r));

  const handleSavePolicies = () => {
    setPolicySaved(true);
    setTimeout(()=>setPolicySaved(false), 2500);
  };

  const tabStyle = (key) => ({
    display:"flex", alignItems:"center", gap:6,
    padding:"9px 16px", borderRadius:999, fontSize:13, fontWeight:600,
    border:`1px solid ${tab===key?"#f0a400":"rgba(255,255,255,0.12)"}`,
    background: tab===key?"#f0a400":"rgba(255,255,255,0.05)",
    color: tab===key?"#241703":"rgba(255,255,255,0.7)",
    cursor:"pointer", fontFamily:"inherit", transition:"all .16s",
  });

  const toggleBtn = (active) => ({
    padding:"8px 20px", borderRadius:10, fontSize:13, fontWeight:700,
    border:`1px solid ${active?"#f0a400":"rgba(255,255,255,0.12)"}`,
    background: active?"#f0a400":"rgba(255,255,255,0.05)",
    color: active?"#241703":"rgba(255,255,255,0.5)",
    cursor:"pointer", fontFamily:"inherit", transition:"all .16s",
  });

  return (
    <AdminLayout title="Platform Settings" subtitle="Manage announcements, policies, reported content and audit log.">

      {/* Tab bar */}
      <div style={{display:"flex",gap:6,marginBottom:22,flexWrap:"wrap"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={tabStyle(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── ANNOUNCEMENTS ── */}
      {tab==="announcements"&&(
        <div className="adm-card">
          <div className="adm-card-hdr">
            <span className="adm-card-title">Manage Announcements</span>
            <button className="adm-btn adm-btn-primary" onClick={()=>setModal("ann")}><FaPlus/> New</button>
          </div>
          <table className="adm-table">
            <thead>
              <tr><th>Title</th><th>Audience</th><th>Date</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {announcements.map(a=>(
                <tr key={a.id}>
                  <td style={{fontWeight:700,color:"#eff0fb"}}>{a.title}</td>
                  <td className="adm-muted">{a.audience}</td>
                  <td className="adm-muted">{a.date}</td>
                  <td><span className={`adm-status-pill ${a.status==="active"?"pill-active":"pill-expired"}`}>{a.status}</span></td>
                  <td>
                    <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={()=>handleDeleteAnn(a.id)}><FaTrash/></button>
                  </td>
                </tr>
              ))}
              {announcements.length===0&&(
                <tr><td colSpan="5" style={{textAlign:"center",padding:32,color:"rgba(255,255,255,0.3)"}}>No announcements yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── POLICIES ── */}
      {tab==="policies"&&(
        <div className="adm-card">
          <div className="adm-card-hdr"><span className="adm-card-title">Account & Course Policies</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>

            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#f0a400",textTransform:"uppercase",letterSpacing:.7,marginBottom:16}}>Course Policies</div>
              <div className="adm-field">
                <label className="adm-label">Max Students Per Course</label>
                <input className="adm-input" type="number" value={policies.maxEnrollment}
                  onChange={e=>setPolicies(p=>({...p,maxEnrollment:e.target.value}))}/>
              </div>
              <div className="adm-field">
                <label className="adm-label">Minimum Passing Score (%)</label>
                <input className="adm-input" type="number" value={policies.minPassScore}
                  onChange={e=>setPolicies(p=>({...p,minPassScore:e.target.value}))}/>
              </div>
              <div className="adm-field">
                <label className="adm-label">Require Admin Approval for New Courses</label>
                <div style={{display:"flex",gap:8,marginTop:6}}>
                  <button style={toggleBtn(policies.approvalRequired)}  onClick={()=>setPolicies(p=>({...p,approvalRequired:true}))}>Yes</button>
                  <button style={toggleBtn(!policies.approvalRequired)} onClick={()=>setPolicies(p=>({...p,approvalRequired:false}))}>No</button>
                </div>
              </div>
              <div className="adm-field">
                <label className="adm-label">Allow Student Self-Enrollment</label>
                <div style={{display:"flex",gap:8,marginTop:6}}>
                  <button style={toggleBtn(policies.allowSelfEnroll)}  onClick={()=>setPolicies(p=>({...p,allowSelfEnroll:true}))}>Yes</button>
                  <button style={toggleBtn(!policies.allowSelfEnroll)} onClick={()=>setPolicies(p=>({...p,allowSelfEnroll:false}))}>No</button>
                </div>
              </div>
            </div>

            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#f0a400",textTransform:"uppercase",letterSpacing:.7,marginBottom:16}}>Account Policies</div>
              <div className="adm-field">
                <label className="adm-label">Session Timeout (minutes)</label>
                <input className="adm-input" type="number" value={policies.sessionTimeout}
                  onChange={e=>setPolicies(p=>({...p,sessionTimeout:e.target.value}))}/>
              </div>
              <div className="adm-field">
                <label className="adm-label">Max Failed Login Attempts Before Lock</label>
                <input className="adm-input" type="number" value={policies.maxLoginAttempts}
                  onChange={e=>setPolicies(p=>({...p,maxLoginAttempts:e.target.value}))}/>
              </div>
              <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 16px",fontSize:12,color:"rgba(255,255,255,0.35)",lineHeight:1.6,border:"1px solid rgba(255,255,255,0.08)"}}>
                ⚠ Policy changes take effect immediately for new sessions. Existing sessions are not affected until they expire.
              </div>
            </div>

          </div>
          <div style={{marginTop:24,display:"flex",alignItems:"center",gap:14}}>
            <button className="adm-btn adm-btn-primary" onClick={handleSavePolicies}>Save Policies</button>
            {policySaved&&<span style={{fontSize:13,color:"#34D399",fontWeight:600}}>✅ Policies saved successfully.</span>}
          </div>
        </div>
      )}

      {/* ── REPORTED CONTENT ── */}
      {tab==="reported"&&(
        <div className="adm-card">
          <div className="adm-card-hdr">
            <span className="adm-card-title">Reported Content</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>
              {reports.filter(r=>r.status==="pending").length} pending review
            </span>
          </div>
          <table className="adm-table">
            <thead>
              <tr><th>Type</th><th>Course</th><th>Reporter</th><th>Date</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {reports.map(r=>(
                <tr key={r.id}>
                  <td style={{fontWeight:700,color:"#eff0fb"}}>{r.type}</td>
                  <td className="adm-muted">{r.course}</td>
                  <td className="adm-muted">{r.reporter}</td>
                  <td className="adm-muted">{r.date}</td>
                  <td>
                    <span className={`adm-status-pill ${
                      r.status==="pending"?"pill-pending":
                      r.status==="resolved"?"pill-active":"pill-dismissed"
                    }`}>{r.status}</span>
                  </td>
                  <td>
                    <div style={{display:"flex",gap:6}}>
                      <button className="adm-btn adm-btn-secondary adm-btn-sm"
                        onClick={()=>{setSelected(r);setModal("report");}}>View</button>
                      {r.status==="pending"&&<>
                        <button className="adm-btn adm-btn-success adm-btn-sm" onClick={()=>handleReportAction(r.id,"resolved")}><FaCheck/></button>
                        <button className="adm-btn adm-btn-danger  adm-btn-sm" onClick={()=>handleReportAction(r.id,"dismissed")}><FaBan/></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab==="audit"&&(
        <div className="adm-card">
          <div className="adm-card-hdr">
            <span className="adm-card-title">Audit Log</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>All admin actions are recorded</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {AUDIT_LOG.map((a,i)=>(
              <div key={i}
                style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 10px",borderRadius:12,transition:"background .16s",cursor:"default",borderBottom:"1px solid rgba(255,255,255,0.05)"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background=""}
              >
                <div style={{width:34,height:34,borderRadius:10,background:`${a.color}22`,color:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{a.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,marginBottom:3,color:"#eff0fb"}}>{a.action}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>{a.detail}</div>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",flexShrink:0,paddingTop:2}}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW ANNOUNCEMENT MODAL */}
      {modal==="ann"&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">New Announcement</div>
            <div className="adm-field">
              <label className="adm-label">Title</label>
              <input className="adm-input" placeholder="Announcement title…"
                value={newAnn.title} onChange={e=>setNewAnn(p=>({...p,title:e.target.value}))}/>
            </div>
            <div className="adm-field">
              <label className="adm-label">Audience</label>
              <select className="adm-input" value={newAnn.audience} onChange={e=>setNewAnn(p=>({...p,audience:e.target.value}))}>
                <option>All Users</option>
                <option>Students</option>
                <option>Tutors</option>
              </select>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="adm-btn adm-btn-primary" onClick={handleAddAnn}>Post Announcement</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW REPORT MODAL */}
      {modal==="report"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Report Details</div>
            {[
              ["Type",     selected.type],
              ["Course",   selected.course],
              ["Reporter", selected.reporter],
              ["Date",     selected.date],
              ["Status",   selected.status],
              ["Details",  selected.detail],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.07)",gap:16}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:600,flexShrink:0}}>{l}</span>
                <span style={{fontSize:13,fontWeight:600,textAlign:"right",color:"#eff0fb"}}>{v}</span>
              </div>
            ))}
            <div className="adm-modal-footer">
              {selected.status==="pending"&&<>
                <button className="adm-btn adm-btn-danger"  onClick={()=>{handleReportAction(selected.id,"dismissed");setModal(null);}}>Dismiss</button>
                <button className="adm-btn adm-btn-success" onClick={()=>{handleReportAction(selected.id,"resolved");setModal(null);}}>Resolve</button>
              </>}
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

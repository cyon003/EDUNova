import { useState } from "react";
import { FaUsers, FaChalkboardTeacher, FaBookOpen, FaBan, FaCheck, FaTimes } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import "../styles/AdminLayout.css";

const STATS = [
  { label: "Total Students",  value: "3,842", change: "+124 this week", up: true,  icon: <FaUsers />,             color: "#f0a400" },
  { label: "Total Tutors",    value: "48",    change: "+3 this week",   up: true,  icon: <FaChalkboardTeacher />, color: "#34D399" },
  { label: "Active Courses",  value: "126",   change: "+8 this month",  up: true,  icon: <FaBookOpen />,          color: "#00D5F7" },
  { label: "Suspended Users", value: "12",    change: "-2 this week",   up: false, icon: <FaBan />,               color: "#F87171" },
];

const ENROLL   = [42,68,55,80,73,91,85,112,98,134,120,142];
const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const RECENT_USERS = [
  { name:"Lena Park",    email:"lena@gmail.com",   role:"student", date:"Today, 09:14",    avatar:"LP", status:"active"    },
  { name:"James Okafor", email:"james@gmail.com",  role:"tutor",   date:"Today, 08:52",    avatar:"JO", status:"active"    },
  { name:"Mia Chen",     email:"mia@gmail.com",    role:"student", date:"Yesterday, 21:30",avatar:"MC", status:"active"    },
  { name:"Carlos Rivera",email:"carlos@gmail.com", role:"student", date:"Yesterday, 18:11",avatar:"CR", status:"suspended" },
  { name:"Sara Müller",  email:"sara@gmail.com",   role:"tutor",   date:"2 days ago",      avatar:"SM", status:"active"    },
];

const ACTIVITY = [
  { action:"Course approved",      detail:"Python Basics by James Okafor",    time:"2 min ago",  color:"#34D399", icon:"✅" },
  { action:"User suspended",       detail:"Carlos Rivera (student)",           time:"18 min ago", color:"#F87171", icon:"🚫" },
  { action:"New tutor registered", detail:"James Okafor joined the platform", time:"1 hr ago",   color:"#00D5F7", icon:"👨‍🏫" },
  { action:"Course submitted",     detail:"UI/UX Masterclass by Sara Müller", time:"2 hr ago",   color:"#f0a400", icon:"📝" },
  { action:"Password reset",       detail:"Admin reset for Mia Chen",         time:"3 hr ago",   color:"#A78BFA", icon:"🔑" },
  { action:"Announcement posted",  detail:"Platform maintenance Saturday",    time:"5 hr ago",   color:"#f0a400", icon:"📢" },
];

const INIT_APPROVALS = [
  { title:"React Advanced Patterns",  tutor:"James Okafor", category:"Web Dev",      submitted:"Today"      },
  { title:"UI/UX Masterclass",        tutor:"Sara Müller",  category:"Design",       submitted:"Yesterday"  },
  { title:"Data Science with Python", tutor:"Lena Park",    category:"Data Science", submitted:"2 days ago" },
];

/* ── Full-width Bar Chart using HTML divs ── */
function BarChart() {
  const max = Math.max(...ENROLL);
  const min = Math.min(...ENROLL);
  return (
    <div style={{ width:"100%", padding:"8px 0" }}>
      {/* Y-axis labels */}
      <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:180, width:"100%", position:"relative" }}>
        {/* Gridlines */}
        {[0,25,50,75,100].map(pct => (
          <div key={pct} style={{
            position:"absolute", left:0, right:0,
            bottom:`${pct}%`,
            borderTop:"1px dashed rgba(255,255,255,0.07)",
            zIndex:0,
          }}>
            <span style={{position:"absolute",right:"100%",paddingRight:6,fontSize:9,color:"rgba(255,255,255,0.25)",transform:"translateY(50%)"}}>
              {Math.round(min + (max-min)*(pct/100))}
            </span>
          </div>
        ))}
        {ENROLL.map((v, i) => {
          const heightPct = ((v - min) / (max - min)) * 75 + 15; // min 15%, max 90%
          const isLast = i === ENROLL.length - 1;
          return (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:0, height:"100%", justifyContent:"flex-end", position:"relative", zIndex:1 }}>
              <span style={{ fontSize:10, color: isLast ? "#f0a400" : "rgba(255,255,255,0.5)", fontWeight:700, marginBottom:4 }}>{v}</span>
              <div style={{
                width:"85%",
                height:`${heightPct}%`,
                background: isLast
                  ? "linear-gradient(180deg,#f5c000,#f0a400,#b07706)"
                  : "linear-gradient(180deg,rgba(240,164,0,0.7),rgba(176,119,6,0.35))",
                borderRadius:"6px 6px 0 0",
                boxShadow: isLast ? "0 0 16px rgba(240,164,0,0.4)" : "none",
                transition:"height .5s ease",
                border: isLast ? "1px solid rgba(240,164,0,0.5)" : "1px solid rgba(240,164,0,0.15)",
              }}/>
            </div>
          );
        })}
      </div>
      {/* Month labels */}
      <div style={{ display:"flex", gap:6, marginTop:8 }}>
        {MONTHS.map((m, i) => (
          <div key={m} style={{ flex:1, textAlign:"center", fontSize:10, color: i===11?"#f0a400":"rgba(255,255,255,0.35)", fontWeight: i===11?700:500 }}>{m}</div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut Chart ── */
function DonutChart() {
  const active=3878, suspended=12, total=active+suspended;
  const c=2*Math.PI*38;
  const a=c*(active/total);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
      <svg viewBox="0 0 100 100" style={{width:110,height:110}}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#f0a400" strokeWidth="14"
          strokeDasharray={`${a} ${c-a}`} strokeDashoffset={c*0.25} strokeLinecap="round"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#F87171" strokeWidth="14"
          strokeDasharray={`${c-a} ${a}`} strokeDashoffset={c*0.25-a} strokeLinecap="round"/>
        <text x="50" y="46" textAnchor="middle" fontSize="11" fontWeight="800" fill="#eff0fb" fontFamily="Plus Jakarta Sans,sans-serif">{total.toLocaleString()}</text>
        <text x="50" y="58" textAnchor="middle" fontSize="7"  fill="rgba(255,255,255,0.4)" fontFamily="Plus Jakarta Sans,sans-serif">users</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:6,width:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#eff0fb",fontWeight:600}}>
          <span style={{width:10,height:10,borderRadius:"50%",background:"#f0a400",display:"inline-block",flexShrink:0}}/>Active — 3,878
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#eff0fb",fontWeight:600}}>
          <span style={{width:10,height:10,borderRadius:"50%",background:"#F87171",display:"inline-block",flexShrink:0}}/>Suspended — 12
        </div>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const [approvals, setApprovals] = useState(INIT_APPROVALS);

  return (
    <AdminLayout title="Dashboard Overview" subtitle="Welcome back — here's what's happening today.">

      {/* ── Stat Cards ── */}
      <div className="adm-stats-grid">
        {STATS.map(s => (
          <div className="adm-stat-card" key={s.label} style={{"--accent": s.color}}>
            <div className="adm-stat-icon" style={{color: s.color}}>{s.icon}</div>
            <div>
              <div className="adm-stat-value">{s.value}</div>
              <div className="adm-stat-label">{s.label}</div>
              <div className={`adm-stat-change ${s.up ? "change-up" : "change-down"}`}>
                {s.up ? "▲" : "▼"} {s.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Chart + Donut + Approvals ── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 220px 280px", gap:16, marginBottom:20}}>

        {/* Full-width bar chart */}
        <div className="adm-card" style={{margin:0}}>
          <div className="adm-card-hdr">
            <span className="adm-card-title">Monthly Enrollments</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>This year</span>
          </div>
          <BarChart/>
          <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
            {[
              {label:"Peak month", value:"Dec — 142", color:"#f0a400"},
              {label:"Total",      value:"1,100",     color:"#34D399"},
              {label:"Avg/month",  value:"92",        color:"#00D5F7"},
            ].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"8px 14px",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:3,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>{s.label}</div>
                <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Account status donut */}
        <div className="adm-card" style={{margin:0}}>
          <div className="adm-card-hdr"><span className="adm-card-title">Account Status</span></div>
          <DonutChart/>
        </div>

        {/* Pending approvals */}
        <div className="adm-card" style={{margin:0}}>
          <div className="adm-card-hdr">
            <span className="adm-card-title">Pending Approvals</span>
            {approvals.length > 0 && (
              <span style={{background:"#f0a400",color:"#241703",fontSize:11,fontWeight:800,width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {approvals.length}
              </span>
            )}
          </div>
          {approvals.length === 0
            ? <div style={{textAlign:"center",padding:24,color:"#34D399",fontWeight:600,fontSize:14}}>✅ All caught up!</div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {approvals.map(c => (
                  <div key={c.title} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",background:"rgba(255,255,255,0.05)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,marginBottom:3,color:"#eff0fb"}}>{c.title}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{c.tutor} · {c.category} · {c.submitted}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button className="adm-btn adm-btn-success adm-btn-sm" onClick={()=>setApprovals(p=>p.filter(x=>x.title!==c.title))}><FaCheck/></button>
                      <button className="adm-btn adm-btn-danger  adm-btn-sm" onClick={()=>setApprovals(p=>p.filter(x=>x.title!==c.title))}><FaTimes/></button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* ── Row 3: Recent Registrations + Activity Log ── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 300px", gap:16}}>

        <div className="adm-card" style={{margin:0}}>
          <div className="adm-card-hdr"><span className="adm-card-title">Recent Registrations</span></div>
          <table className="adm-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Joined</th><th>Status</th></tr>
            </thead>
            <tbody>
              {RECENT_USERS.map(u => (
                <tr key={u.name}>
                  <td>
                    <div className="adm-user-cell">
                      <div className="adm-cell-avatar">{u.avatar}</div>
                      <div>
                        <div className="adm-cell-name">{u.name}</div>
                        <div className="adm-cell-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`adm-role-badge role-${u.role}`}>{u.role}</span></td>
                  <td className="adm-muted">{u.date}</td>
                  <td><span className={`adm-status-pill ${u.status==="active"?"pill-active":"pill-suspended"}`}>{u.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="adm-card" style={{margin:0}}>
          <div className="adm-card-hdr"><span className="adm-card-title">Activity Log</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {ACTIVITY.map((a,i) => (
              <div key={i}
                style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 8px",borderRadius:10,transition:"background .16s",cursor:"default"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                onMouseLeave={e=>e.currentTarget.style.background=""}
              >
                <div style={{width:30,height:30,borderRadius:8,background:`${a.color}22`,color:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{a.icon}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:2,color:"#eff0fb"}}>{a.action}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:2}}>{a.detail}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

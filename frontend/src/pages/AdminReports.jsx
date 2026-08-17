import { useState } from "react";
import { FaDownload, FaChartBar, FaUsers, FaBookOpen, FaGraduationCap } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import "../styles/AdminLayout.css";

const MONTHLY_ENROLL = [42,68,55,80,73,91,85,112,98,134,120,142];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const POPULAR_COURSES = [
  { title:"Python Basics",       students:92, completion:78, tutor:"James Okafor", category:"Web Dev"      },
  { title:"Data Science Intro",  students:65, completion:82, tutor:"Marco Rossi",  category:"Data Science" },
  { title:"Business Strategy",   students:65, completion:60, tutor:"David Kim",    category:"Business"     },
  { title:"UI/UX Design",        students:58, completion:45, tutor:"David Kim",    category:"Design"       },
  { title:"Ethical Hacking",     students:28, completion:70, tutor:"Lena Park",    category:"Cybersecurity"},
];

const TUTOR_ACTIVITY = [
  { name:"James Okafor", courses:3, students:166, avgScore:82, lastActive:"Today"      },
  { name:"Sara Müller",  courses:2, students:98,  avgScore:76, lastActive:"Yesterday"  },
  { name:"David Kim",    courses:4, students:210, avgScore:88, lastActive:"Today"      },
  { name:"Marco Rossi",  courses:2, students:87,  avgScore:79, lastActive:"2 days ago" },
  { name:"Lena Park",    courses:1, students:40,  avgScore:71, lastActive:"3 days ago" },
];

const STUDENT_ACTIVITY = [
  { name:"Lena Park",    enrolled:4, completed:2, avgScore:85, lastActive:"Today"      },
  { name:"Ahmed Hassan", enrolled:5, completed:3, avgScore:91, lastActive:"Today"      },
  { name:"Diana Ford",   enrolled:6, completed:4, avgScore:88, lastActive:"2 days ago" },
  { name:"Mia Chen",     enrolled:3, completed:1, avgScore:72, lastActive:"Yesterday"  },
  { name:"Tom Blake",    enrolled:1, completed:0, avgScore:45, lastActive:"1 week ago" },
];

/* ── Full-width bar chart ── */
function BarChart({ data, labels }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  return (
    <div style={{width:"100%", padding:"8px 0"}}>
      <div style={{display:"flex", gap:6, alignItems:"flex-end", height:200, width:"100%", position:"relative"}}>
        {/* Gridlines */}
        {[0,25,50,75,100].map(pct=>(
          <div key={pct} style={{
            position:"absolute", left:0, right:0,
            bottom:`${pct}%`,
            borderTop:"1px dashed rgba(255,255,255,0.06)",
            zIndex:0,
          }}>
            <span style={{position:"absolute",right:"calc(100% + 6px)",fontSize:9,color:"rgba(255,255,255,0.25)",transform:"translateY(50%)",whiteSpace:"nowrap"}}>
              {Math.round(min+(max-min)*(pct/100))}
            </span>
          </div>
        ))}
        {data.map((v,i)=>{
          const h = ((v-min)/(max-min))*75+15;
          const isLast = i===data.length-1;
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:0,height:"100%",justifyContent:"flex-end",position:"relative",zIndex:1}}>
              <span style={{fontSize:10,color:isLast?"#f0a400":"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:4}}>{v}</span>
              <div style={{
                width:"80%",
                height:`${h}%`,
                background: isLast
                  ? "linear-gradient(180deg,#f5c000,#f0a400,#b07706)"
                  : "linear-gradient(180deg,rgba(240,164,0,0.65),rgba(176,119,6,0.3))",
                borderRadius:"6px 6px 0 0",
                boxShadow: isLast?"0 0 16px rgba(240,164,0,0.4)":"none",
                border: isLast?"1px solid rgba(240,164,0,0.5)":"1px solid rgba(240,164,0,0.12)",
                transition:"height .5s ease",
                minHeight:4,
              }}/>
            </div>
          );
        })}
      </div>
      {/* Month labels */}
      <div style={{display:"flex",gap:6,marginTop:8}}>
        {labels.map((m,i)=>(
          <div key={m} style={{flex:1,textAlign:"center",fontSize:10,color:i===labels.length-1?"#f0a400":"rgba(255,255,255,0.35)",fontWeight:i===labels.length-1?700:500}}>{m}</div>
        ))}
      </div>
    </div>
  );
}

function exportCSV(filename, headers, rows) {
  const csv = [headers.join(","), ...rows.map(r=>r.join(","))].join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { key:"enrollment", label:"Enrollments",       icon:<FaChartBar/>     },
  { key:"courses",    label:"Course Completion",  icon:<FaBookOpen/>     },
  { key:"tutors",     label:"Tutor Activity",     icon:<FaGraduationCap/>},
  { key:"students",   label:"Student Activity",   icon:<FaUsers/>        },
];

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState("enrollment");

  const totalEnroll   = MONTHLY_ENROLL.reduce((a,b)=>a+b,0);
  const avgCompletion = Math.round(POPULAR_COURSES.reduce((a,c)=>a+c.completion,0)/POPULAR_COURSES.length);

  const handleExport = () => {
    if (activeTab==="enrollment")
      exportCSV("enrollment_report.csv",["Month","Enrollments"],MONTHS.map((m,i)=>[m,MONTHLY_ENROLL[i]]));
    else if (activeTab==="courses")
      exportCSV("courses_report.csv",["Course","Tutor","Category","Students","Completion %"],
        POPULAR_COURSES.map(c=>[c.title,c.tutor,c.category,c.students,c.completion]));
    else if (activeTab==="tutors")
      exportCSV("tutor_activity.csv",["Tutor","Courses","Students","Avg Score","Last Active"],
        TUTOR_ACTIVITY.map(t=>[t.name,t.courses,t.students,t.avgScore,t.lastActive]));
    else
      exportCSV("student_activity.csv",["Student","Enrolled","Completed","Avg Score","Last Active"],
        STUDENT_ACTIVITY.map(s=>[s.name,s.enrolled,s.completed,s.avgScore,s.lastActive]));
  };

  const scoreColor = (s) => s>=80?"#34D399":s>=65?"#f0a400":"#F87171";

  return (
    <AdminLayout title="Reports & Analytics" subtitle="View platform statistics and export data.">

      {/* Summary stats */}
      <div className="adm-stats-grid">
        {[
          { label:"Total Enrollments", value: totalEnroll,        color:"#f0a400" },
          { label:"Avg Completion",    value: `${avgCompletion}%`,color:"#34D399" },
          { label:"Active Students",   value: "3,842",            color:"#00D5F7" },
          { label:"Active Tutors",     value: "43",               color:"#A78BFA" },
        ].map(s=>(
          <div className="adm-stat-card" key={s.label} style={{"--accent":s.color}}>
            <div>
              <div className="adm-stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="adm-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar + Export */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setActiveTab(t.key)}
              style={{
                display:"flex",alignItems:"center",gap:6,
                padding:"9px 16px",borderRadius:999,fontSize:13,fontWeight:600,
                border:`1px solid ${activeTab===t.key?"#f0a400":"rgba(255,255,255,0.12)"}`,
                background: activeTab===t.key?"#f0a400":"rgba(255,255,255,0.05)",
                color: activeTab===t.key?"#241703":"rgba(255,255,255,0.7)",
                cursor:"pointer",fontFamily:"inherit",transition:"all .16s",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <button className="adm-btn adm-btn-primary" onClick={handleExport}>
          <FaDownload/> Export CSV
        </button>
      </div>

      {/* ENROLLMENT TAB */}
      {activeTab==="enrollment"&&(
        <div className="adm-card">
          <div className="adm-card-hdr">
            <span className="adm-card-title">Monthly Enrollments — {new Date().getFullYear()}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Total: {totalEnroll}</span>
          </div>
          <BarChart data={MONTHLY_ENROLL} labels={MONTHS}/>
          <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
            {[
              {label:"Best Month", value:"Dec (142)",                               color:"#f0a400"},
              {label:"Avg/Month",  value:`${Math.round(totalEnroll/12)}`,           color:"#34D399"},
              {label:"Growth YoY", value:"+34%",                                   color:"#00D5F7"},
            ].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 16px",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>{s.label}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.color}}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COURSE COMPLETION TAB */}
      {activeTab==="courses"&&(
        <div className="adm-card">
          <div className="adm-card-hdr">
            <span className="adm-card-title">Course Completion Rates</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Platform avg: {avgCompletion}%</span>
          </div>
          <table className="adm-table">
            <thead>
              <tr><th>Course</th><th>Tutor</th><th>Category</th><th>Students</th><th>Completion</th></tr>
            </thead>
            <tbody>
              {[...POPULAR_COURSES].sort((a,b)=>b.students-a.students).map(c=>(
                <tr key={c.title}>
                  <td style={{fontWeight:700,color:"#eff0fb"}}>{c.title}</td>
                  <td className="adm-muted">{c.tutor}</td>
                  <td className="adm-muted">{c.category}</td>
                  <td className="adm-muted">{c.students}</td>
                  <td>
                    <div className="adm-progress-wrap">
                      <div className="adm-progress-track">
                        <div className="adm-progress-fill" style={{width:`${c.completion}%`}}/>
                      </div>
                      <span className="adm-progress-pct">{c.completion}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TUTOR ACTIVITY TAB */}
      {activeTab==="tutors"&&(
        <div className="adm-card">
          <div className="adm-card-hdr"><span className="adm-card-title">Tutor Activity</span></div>
          <table className="adm-table">
            <thead>
              <tr><th>Tutor</th><th>Courses</th><th>Students</th><th>Avg Score</th><th>Last Active</th></tr>
            </thead>
            <tbody>
              {TUTOR_ACTIVITY.map(t=>(
                <tr key={t.name}>
                  <td style={{fontWeight:700,color:"#eff0fb"}}>{t.name}</td>
                  <td className="adm-muted">{t.courses}</td>
                  <td className="adm-muted">{t.students}</td>
                  <td><span style={{fontWeight:800,color:scoreColor(t.avgScore)}}>{t.avgScore}%</span></td>
                  <td className="adm-muted">{t.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* STUDENT ACTIVITY TAB */}
      {activeTab==="students"&&(
        <div className="adm-card">
          <div className="adm-card-hdr"><span className="adm-card-title">Student Activity</span></div>
          <table className="adm-table">
            <thead>
              <tr><th>Student</th><th>Enrolled</th><th>Completed</th><th>Avg Score</th><th>Last Active</th></tr>
            </thead>
            <tbody>
              {STUDENT_ACTIVITY.map(s=>(
                <tr key={s.name}>
                  <td style={{fontWeight:700,color:"#eff0fb"}}>{s.name}</td>
                  <td className="adm-muted">{s.enrolled}</td>
                  <td className="adm-muted">{s.completed}</td>
                  <td><span style={{fontWeight:800,color:scoreColor(s.avgScore)}}>{s.avgScore}%</span></td>
                  <td className="adm-muted">{s.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </AdminLayout>
  );
}

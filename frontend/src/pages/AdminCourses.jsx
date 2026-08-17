import { useState } from "react";
import { FaSearch, FaCheck, FaTimes, FaEye, FaArchive, FaGlobe } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import "../styles/AdminLayout.css";

const TUTORS     = ["James Okafor","Sara Müller","David Kim","Marco Rossi","Lena Park"];
const CATEGORIES = ["All","Web Dev","Design","Data Science","AI & ML","Cybersecurity","Business"];
const LEVELS     = ["All","Beginner","Intermediate","Advanced"];

const INIT_COURSES = [
  { id:1, title:"Python Basics",           tutor:"James Okafor", category:"Web Dev",       level:"Beginner",     students:92,  status:"published",   submitted:"Jan 5, 2024"  },
  { id:2, title:"React Advanced Patterns", tutor:"Sara Müller",  category:"Web Dev",       level:"Advanced",     students:0,   status:"pending",     submitted:"Today"        },
  { id:3, title:"UI/UX Masterclass",       tutor:"David Kim",    category:"Design",        level:"Intermediate", students:58,  status:"pending",     submitted:"Yesterday"    },
  { id:4, title:"Data Science Intro",      tutor:"Marco Rossi",  category:"Data Science",  level:"Beginner",     students:40,  status:"published",   submitted:"Feb 1, 2024"  },
  { id:5, title:"Ethical Hacking",         tutor:"Lena Park",    category:"Cybersecurity", level:"Advanced",     students:28,  status:"published",   submitted:"Mar 3, 2024"  },
  { id:6, title:"Intro to Java",           tutor:"James Okafor", category:"Web Dev",       level:"Beginner",     students:12,  status:"archived",    submitted:"Dec 1, 2023"  },
  { id:7, title:"ML with PyTorch",         tutor:"Sara Müller",  category:"AI & ML",       level:"Advanced",     students:0,   status:"pending",     submitted:"2 days ago"   },
  { id:8, title:"Business Strategy 101",   tutor:"David Kim",    category:"Business",      level:"Intermediate", students:65,  status:"unpublished", submitted:"Feb 20, 2024" },
];

export default function AdminCourses() {
  const [courses,    setCourses]    = useState(INIT_COURSES);
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState("All");
  const [levFilter,  setLevFilter]  = useState("All");
  const [statFilter, setStatFilter] = useState("all");
  const [modal,      setModal]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [assignTutor,setAssignTutor]= useState("");

  const filtered = courses.filter(c => {
    const mSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
                    c.tutor.toLowerCase().includes(search.toLowerCase());
    const mCat  = catFilter  === "All" || c.category === catFilter;
    const mLev  = levFilter  === "All" || c.level    === levFilter;
    const mStat = statFilter === "all" || c.status   === statFilter;
    return mSearch && mCat && mLev && mStat;
  });

  const updateStatus = (id, status) =>
    setCourses(p => p.map(c => c.id===id ? {...c,status} : c));

  const openView    = (c) => { setSelected(c); setModal("view"); };
  const openAssign  = (c) => { setSelected(c); setAssignTutor(c.tutor); setModal("assign"); };
  const openArchive = (c) => { setSelected(c); setModal("archive"); };

  const handleAssign = () => {
    setCourses(p => p.map(c => c.id===selected.id ? {...c,tutor:assignTutor} : c));
    setModal(null);
  };

  return (
    <AdminLayout title="Course Management" subtitle="Approve, publish, archive and assign courses.">

      {/* Stats */}
      <div className="adm-stats-grid">
        {[
          { label:"Total Courses",    value: courses.length,                                       color:"#f0a400" },
          { label:"Published",        value: courses.filter(c=>c.status==="published").length,     color:"#34D399" },
          { label:"Pending Approval", value: courses.filter(c=>c.status==="pending").length,       color:"#00D5F7" },
          { label:"Archived",         value: courses.filter(c=>c.status==="archived").length,      color:"rgba(255,255,255,0.4)" },
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
          <span className="adm-card-title">All Courses</span>
        </div>

        <div className="adm-search-row">
          <div className="adm-search-box">
            <FaSearch className="adm-search-icon"/>
            <input placeholder="Search by title or tutor…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select className="adm-select" value={statFilter} onChange={e=>setStatFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="pending">Pending</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="adm-select" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
          <select className="adm-select" value={levFilter} onChange={e=>setLevFilter(e.target.value)}>
            {LEVELS.map(l=><option key={l}>{l}</option>)}
          </select>
        </div>

        <table className="adm-table">
          <thead>
            <tr><th>Course</th><th>Tutor</th><th>Category</th><th>Level</th><th>Students</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(c=>(
              <tr key={c.id}>
                <td style={{fontWeight:700,color:"#eff0fb"}}>{c.title}</td>
                <td className="adm-muted">{c.tutor}</td>
                <td className="adm-muted">{c.category}</td>
                <td className="adm-muted">{c.level}</td>
                <td className="adm-muted">{c.students}</td>
                <td><span className={`adm-status-pill pill-${c.status}`}>{c.status}</span></td>
                <td>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openView(c)} title="View"><FaEye/></button>

                    {c.status==="pending"&&<>
                      <button className="adm-btn adm-btn-success adm-btn-sm" onClick={()=>updateStatus(c.id,"published")} title="Approve"><FaCheck/></button>
                      <button className="adm-btn adm-btn-danger  adm-btn-sm" onClick={()=>updateStatus(c.id,"rejected")}  title="Reject"><FaTimes/></button>
                    </>}

                    {c.status==="published"&&
                      <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>updateStatus(c.id,"unpublished")} title="Unpublish"><FaGlobe/></button>
                    }
                    {c.status==="unpublished"&&
                      <button className="adm-btn adm-btn-success adm-btn-sm" onClick={()=>updateStatus(c.id,"published")} title="Publish"><FaGlobe/></button>
                    }

                    {c.status!=="archived"&&
                      <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openArchive(c)} title="Archive"><FaArchive/></button>
                    }

                    <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={()=>openAssign(c)} style={{fontSize:10}}>Assign</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0&&(
              <tr><td colSpan="7" style={{textAlign:"center",padding:32,color:"rgba(255,255,255,0.3)"}}>No courses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW */}
      {modal==="view"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Course Details</div>
            <div style={{padding:16,background:"rgba(255,255,255,0.05)",borderRadius:12,marginBottom:20,border:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{fontSize:18,fontWeight:800,marginBottom:6,color:"#eff0fb"}}>{selected.title}</div>
              <span className={`adm-status-pill pill-${selected.status}`}>{selected.status}</span>
            </div>
            {[
              ["Tutor",      selected.tutor],
              ["Category",   selected.category],
              ["Level",      selected.level],
              ["Students",   selected.students],
              ["Submitted",  selected.submitted],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:600}}>{l}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#eff0fb"}}>{v}</span>
              </div>
            ))}
            <div className="adm-modal-footer">
              {selected.status==="pending"&&<>
                <button className="adm-btn adm-btn-danger"  onClick={()=>{updateStatus(selected.id,"rejected");setModal(null);}}>Reject</button>
                <button className="adm-btn adm-btn-success" onClick={()=>{updateStatus(selected.id,"published");setModal(null);}}>Approve</button>
              </>}
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN TUTOR */}
      {modal==="assign"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Assign Tutor — {selected.title}</div>
            <div className="adm-field">
              <label className="adm-label">Select Tutor</label>
              <select className="adm-input" value={assignTutor} onChange={e=>setAssignTutor(e.target.value)}>
                {TUTORS.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="adm-btn adm-btn-primary" onClick={handleAssign}>Save Assignment</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM ARCHIVE */}
      {modal==="archive"&&selected&&(
        <div className="adm-modal-overlay" onClick={()=>setModal(null)}>
          <div className="adm-modal" onClick={e=>e.stopPropagation()}>
            <div className="adm-modal-title">Archive Course</div>
            <div className="adm-confirm">
              <p>Are you sure you want to archive <strong>{selected.title}</strong>?</p>
              <p style={{marginTop:8}}>It will be hidden from students but not permanently deleted.</p>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="adm-btn adm-btn-danger" onClick={()=>{updateStatus(selected.id,"archived");setModal(null);}}>Yes, Archive</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

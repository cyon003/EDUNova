import { useEffect, useId, useRef, useState } from "react";
import { FaBookOpen, FaCloudUploadAlt, FaGraduationCap, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { API_ROOT } from "../utils/courseApi";
import QuizAttachment from "./QuizAttachment";
import { deleteQuizMedia } from "../utils/quizMedia";
import { canPreviewResource, fileType, formatFileSize, getLessonPrimaryMedia, isMediaResource, lessonReferences } from "../utils/lessonMedia";

const mediaExtensions = ["mp4", "webm", "ogv", "mov", "m4v", "mp3", "wav", "m4a", "ogg"];
const resourceExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "jpg", "jpeg", "png", "gif", "webp", ...mediaExtensions];
const mediaAccept = ".mp4,.webm,.ogv,.mov,.m4v,.mp3,.wav,.m4a,.ogg";
const resourceAccept = resourceExtensions.map((item) => `.${item}`).join(",");
const maxFileSize = 2 * 1024 * 1024 * 1024;
const emptyQuiz = { title: "Lesson Quiz", questions: [] };
const emptyDraft = { title: "", transcript: "", description: "", summary: "", referenceLinks: "", mainVideo: null, documents: [], quiz: null };
const editable = (lesson) => ({
  ...emptyDraft,
  title: lesson?.title || "",
  transcript: lesson?.transcript || "",
  description: lesson?.description || "",
  summary: lesson?.summary || "",
  referenceLinks: lessonReferences(lesson).map((item) => `${item.label || "Reference"} | ${item.url}`).join("\n"),
  duration: lesson?.duration || "",
  quiz: lesson?.quiz ? {
    title: lesson.quiz.title || "Lesson Quiz",
    questions: (lesson.quiz.questions || []).map((question) => ({
      question: question.question || "",
      type: question.type || "multiple_choice",
      options: (question.options || []).map((option) => option.text || ""),
      correctOption: Number.isInteger(question.correctOption) ? question.correctOption : 0,
      media: question.media?.storedName ? { originalName: question.media.originalName, storedName: question.media.storedName, mimeType: question.media.mimeType, size: question.media.size, kind: question.media.kind } : null,
    })),
  } : null,
});

function UploadCard({ kind, title, hint, accept, multiple, files, onFiles, onRemove }) {
  const input = useRef(null);
  return <section className="lesson-upload-card" onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();onFiles(event.dataTransfer.files)}}>
    <button type="button" className="lesson-upload-target" onClick={()=>input.current?.click()}><FaCloudUploadAlt/><strong>{title}</strong><span>Drag and drop or browse</span><small>{hint}</small></button>
    <input ref={input} className="lesson-hidden-file" type="file" accept={accept} multiple={multiple} onChange={(event)=>onFiles(event.target.files)}/>
    <div className="lesson-selected-files">{files.map((file,index)=><div key={`${file.name}-${index}`}><span><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span><button type="button" onClick={()=>input.current?.click()}>{kind==="video"?"Replace":"Add"}</button><button type="button" onClick={()=>onRemove(index)}>Remove</button></div>)}</div>
  </section>;
}

function LessonFields({ value, setValue }) {
  return <div className="lesson-modal-fields wide">
    <label><span>Title</span><input required maxLength="200" value={value.title} onChange={(event)=>setValue({...value,title:event.target.value})}/></label>
    <label><span>Transcript (Optional)</span><textarea rows="7" maxLength="50000" value={value.transcript} onChange={(event)=>setValue({...value,transcript:event.target.value})}/><small>{value.transcript.length}/50000</small></label>
    <label><span>Description (Optional)</span><textarea rows="4" value={value.description} onChange={(event)=>setValue({...value,description:event.target.value})}/></label>
    <label><span>Summary (Optional)</span><textarea rows="5" maxLength="5000" value={value.summary} onChange={(event)=>setValue({...value,summary:event.target.value})}/><small>{value.summary.length}/5000</small></label>
    <label><span>References (Optional)</span><textarea rows="4" placeholder="One per line: Label | https://example.com" value={value.referenceLinks} onChange={(event)=>setValue({...value,referenceLinks:event.target.value})}/></label>
  </div>;
}

function QuizEditor({ courseId, quiz, setQuiz }) {
  const groupId = useId();
  const current = quiz || emptyQuiz;
  // An upload finishes after the tutor may have kept typing, so its result is
  // merged into the latest quiz rather than the one from when it started.
  const latestQuiz = useRef(quiz);
  useEffect(() => { latestQuiz.current = quiz; });

  const setMedia = (index, media) => {
    const latest = latestQuiz.current || emptyQuiz;
    setQuiz({ ...latest, questions: latest.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, media } : item)) });
  };

  const mapQuestions = (transform) => setQuiz({ ...current, questions: current.questions.map(transform) });

  const addQuestion = () => {
    setQuiz({
      ...current,
      questions: [...(current.questions || []), { question: "", type: "multiple_choice", options: ["", ""], correctOption: 0 }],
    });
  };

  const updateQuestion = (index, changes) => mapQuestions((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item));

  const removeQuestion = (index) => {
    deleteQuizMedia(courseId, current.questions[index]?.media?.storedName);
    setQuiz({ ...current, questions: current.questions.filter((_, itemIndex) => itemIndex !== index) });
  };

  const updateOption = (questionIndex, optionIndex, value) => mapQuestions((item, itemIndex) => {
    if (itemIndex !== questionIndex) return item;
    const options = [...item.options];
    options[optionIndex] = value;
    return { ...item, options };
  });

  const addOption = (questionIndex) => mapQuestions((item, itemIndex) => {
    if (itemIndex !== questionIndex || item.options.length >= 5) return item;
    return { ...item, options: [...item.options, ""] };
  });

  const removeOption = (questionIndex, optionIndex) => mapQuestions((item, itemIndex) => {
    if (itemIndex !== questionIndex || item.options.length <= 2) return item;
    const options = item.options.filter((_, index) => index !== optionIndex);
    let correctOption = item.correctOption;
    if (correctOption === optionIndex) correctOption = 0;
    else if (correctOption > optionIndex) correctOption -= 1;
    return { ...item, options, correctOption };
  });

  const changeType = (index, type) => mapQuestions((item, itemIndex) => {
    if (itemIndex !== index) return item;
    if (type === "true_false") return { ...item, type, options: ["True", "False"], correctOption: 0 };
    return { ...item, type, options: ["", ""], correctOption: 0 };
  });

  if (!quiz) {
    return (
      <section className="lesson-quiz-editor is-empty wide">
        <div className="lesson-quiz-intro">
          <strong>Lesson quiz</strong>
          <p>Add a quiz to this lesson. You can edit it later.</p>
        </div>
        <button type="button" className="primary" onClick={() => setQuiz({ ...emptyQuiz, questions: [] })}>
          <FaPlus /> Create Quiz
        </button>
      </section>
    );
  }

  return (
    <section className="lesson-quiz-editor wide">
      <div className="lesson-quiz-header">
        <div className="lesson-quiz-intro">
          <strong>Lesson quiz</strong>
          <p>Create multiple-choice or true/false questions.</p>
        </div>
        <button type="button" className="lesson-quiz-ghost danger" onClick={() => { current.questions.forEach((item) => deleteQuizMedia(courseId, item.media?.storedName)); setQuiz(null); }}>
          <FaTrash /> Remove quiz
        </button>
      </div>

      <label className="lesson-quiz-field">
        <span>Quiz title</span>
        <input type="text" maxLength="200" value={quiz.title} onChange={(event) => setQuiz({ ...quiz, title: event.target.value })} />
      </label>

      {quiz.questions.length === 0 && <p className="lesson-quiz-empty">No questions yet. Add your first question below.</p>}

      {quiz.questions.map((item, index) => (
        <article className="lesson-quiz-question" key={`quiz-question-${index}`}>
          <header>
            <span className="lesson-quiz-badge">Question {index + 1}</span>
            <button type="button" className="lesson-quiz-ghost danger" onClick={() => removeQuestion(index)}>
              <FaTrash /> Delete
            </button>
          </header>

          <label className="lesson-quiz-field">
            <span>Question</span>
            <textarea rows="3" maxLength="1000" placeholder="Type your question here" value={item.question} onChange={(event) => updateQuestion(index, { question: event.target.value })} />
          </label>

          <QuizAttachment courseId={courseId} media={item.media || null} onChange={(media) => setMedia(index, media)} />

          <label className="lesson-quiz-field lesson-quiz-type">
            <span>Question type</span>
            <select value={item.type} onChange={(event) => changeType(index, event.target.value)}>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="true_false">True / False</option>
            </select>
          </label>

          <fieldset className="lesson-quiz-options">
            <legend>Answer choices · select the correct one</legend>
            {item.options.map((option, optionIndex) => (
              <div className={`lesson-quiz-option${item.correctOption === optionIndex ? " is-correct" : ""}`} key={`option-${optionIndex}`}>
                <span className="lesson-quiz-letter" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
                <input
                  type="text"
                  aria-label={`Choice ${optionIndex + 1}`}
                  placeholder={`Choice ${optionIndex + 1}`}
                  disabled={item.type === "true_false"}
                  value={option}
                  onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                />
                <label className="lesson-quiz-correct">
                  <input
                    type="radio"
                    name={`${groupId}-correct-${index}`}
                    checked={item.correctOption === optionIndex}
                    onChange={() => updateQuestion(index, { correctOption: optionIndex })}
                  />
                  <span>Correct</span>
                </label>
                {item.type === "multiple_choice" && item.options.length > 2 && (
                  <button type="button" className="lesson-quiz-icon" aria-label={`Remove choice ${optionIndex + 1}`} onClick={() => removeOption(index, optionIndex)}>
                    <FaTimes />
                  </button>
                )}
              </div>
            ))}
          </fieldset>

          {item.type === "multiple_choice" && item.options.length < 5 && (
            <button type="button" className="lesson-quiz-ghost" onClick={() => addOption(index)}>
              <FaPlus /> Add choice
            </button>
          )}
        </article>
      ))}

      <button type="button" className="primary lesson-quiz-add" disabled={quiz.questions.length >= 20} onClick={addQuestion}>
        <FaPlus /> Add Question
      </button>
    </section>
  );
}

function usePersistedMedia(course, lesson, index) {
  const mediaKey = getLessonPrimaryMedia(lesson)?.storedName || "";
  const [state, setState] = useState({ key: "", url: "", error: "" });
  useEffect(() => {
    if (!getLessonPrimaryMedia(lesson)) return undefined;
    const controller = new AbortController();
    fetch(`${API_ROOT}/courses/${encodeURIComponent(course.slug)}/lessons/${index}/media-access`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, signal: controller.signal })
      .then((response)=>{if(!response.ok)throw new Error("The saved video is unavailable.");return response.json()})
      .then(({url})=>setState({key:mediaKey,url,error:""}))
      .catch((error)=>{if(error.name!=="AbortError")setState({key:mediaKey,url:"",error:error.message})});
    return ()=>controller.abort();
  }, [course.slug, index, lesson, mediaKey]);
  return state.key===mediaKey?state:{key:mediaKey,url:"",error:""};
}

export default function LessonManager({ course, form, setForm, add, update, remove, removeMain, selectMain, removeResource, close }) {
  const [selected, setSelected] = useState(0);
  const lesson = course.lessons[selected];
  const [draft, setDraft] = useState(()=>editable(lesson));
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const primary = getLessonPrimaryMedia(lesson);
  const persistedMedia = usePersistedMedia(course, lesson, selected);
  const dirty = Boolean(form.title || form.transcript || form.description || form.summary || form.referenceLinks || form.mainVideo || form.resources.length || form.quiz);

  useEffect(()=>{if(!modalOpen)return undefined;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const escape=(event)=>{if(event.key==="Escape"&&(!dirty||window.confirm("Discard unsaved lesson changes?")))setModalOpen(false)};window.addEventListener("keydown",escape);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",escape)}},[dirty,modalOpen]);
  useEffect(()=>()=>window.clearTimeout(toastTimer.current),[]);

  const validateFiles = (files, allowed, one=false) => {
    const chosen = Array.from(files || []);
    const invalid = chosen.find((file)=>!allowed.includes(file.name.split(".").pop()?.toLowerCase()) || file.size > maxFileSize);
    if (invalid) { setMessage(`${invalid.name} has an unsupported type or exceeds 2 GiB.`); return []; }
    setMessage(""); return one ? chosen.slice(0,1) : chosen;
  };
  const openModal = () => { setSaveError(""); setModalOpen(true); };
  const closeModal = () => { if (!dirty || window.confirm("Discard unsaved lesson changes?")) { setModalOpen(false); setSaveError(""); setForm({...form,...emptyDraft,resources:[]}); } };
  const createLesson = async (event) => { event.preventDefault(); setSaving(true); try { const saved=await add(); setSelected(Math.max(saved.lessons.length-1,0)); setDraft(editable(saved.lessons.at(-1))); setModalOpen(false); setMessage(""); setSaveError(""); } catch (error) { setSaveError(error.message); } finally { setSaving(false); } };
  const showToast = (text) => { window.clearTimeout(toastTimer.current); setToast(text); toastTimer.current=window.setTimeout(()=>setToast(""),3000); };
  const saveLesson = async (event) => { event.preventDefault(); setSaving(true); try { const saved=await update(lesson._id,draft); const savedLesson=saved.lessons.find((item)=>String(item._id)===String(lesson._id));setDraft(editable(savedLesson));setMessage("");setSaveError("");showToast("Lesson saved"); } catch (error) { setSaveError(error.message); } finally { setSaving(false); } };
  const accessResource = async (resource, action) => { const response=await fetch(`${API_ROOT}/courses/${encodeURIComponent(course.slug)}/lessons/${selected}/resources/${resource._id}/${action}`,{headers:{Authorization:`Bearer ${localStorage.getItem("token")}`}});if(!response.ok){setMessage("This resource is unavailable.");return}const url=URL.createObjectURL(await response.blob());if(action==="view")window.open(url,"_blank","noopener,noreferrer");else{const link=document.createElement("a");link.href=url;link.download=resource.originalName;link.click()}window.setTimeout(()=>URL.revokeObjectURL(url),60000)};

  return <div className="lesson-studio"><header><div><FaGraduationCap/><strong>EDUNOVA</strong><span>{course.name}</span></div><button onClick={close}>Close</button></header><div className="lesson-studio-layout"><main>
    {message&&<p className="lesson-manager-message" role="status">{message}</p>}
    {!lesson?<><div className="lesson-editor-heading"><h2>Edit Lesson</h2><button className="primary" type="button" onClick={openModal}><FaPlus/> New Lesson</button></div><div className="lesson-preview empty"><FaBookOpen/><strong>Select a lesson or add the first one</strong></div></>:<>
      <div className="lesson-preview">{primary&&persistedMedia.url?<video key={persistedMedia.url} src={persistedMedia.url} controls onError={()=>setMessage("This video format is not supported by your browser.")}/>:<div className="lesson-preview empty"><FaBookOpen/><strong>{persistedMedia.error||"No lesson video has been uploaded."}</strong></div>}</div>
      <form className="form-grid lesson-builder lesson-editor" onSubmit={saveLesson}><div className="lesson-editor-heading wide"><h2>Edit Lesson</h2><button className="primary" type="button" onClick={openModal}><FaPlus/> New Lesson</button></div><div className="lesson-upload-grid wide">
        <UploadCard kind="video" title="Replace lesson video" hint="MP4, WebM or Ogg · one file" accept={mediaAccept} files={draft.mainVideo?[draft.mainVideo]:[]} onFiles={(files)=>{const chosen=validateFiles(files,mediaExtensions,true);if(chosen[0])setDraft({...draft,mainVideo:chosen[0]})}} onRemove={()=>setDraft({...draft,mainVideo:null})}/>
        <UploadCard kind="documents" title="Add supporting documents" hint="PDF, Office, TXT, images and additional media" accept={resourceAccept} multiple files={draft.documents} onFiles={(files)=>setDraft({...draft,documents:[...draft.documents,...validateFiles(files,resourceExtensions)]})} onRemove={(index)=>setDraft({...draft,documents:draft.documents.filter((_,item)=>item!==index)})}/>
      </div><div className="wide lesson-current-media"><strong>Existing main video</strong><span>{primary?.originalName||"None"}</span>{primary&&<button type="button" onClick={()=>removeMain(lesson._id)}>Remove Video</button>}</div><LessonFields value={draft} setValue={setDraft}/><QuizEditor courseId={course._id} quiz={draft.quiz} setQuiz={(quiz) => setDraft((current)=>({...current, quiz}))}/>{saveError&&<p className="lesson-form-error wide" role="alert">{saveError}</p>}<footer className="lesson-editor-actions wide">{toast&&<span className="lesson-save-toast" role="status" aria-live="polite">{toast}</span>}<button type="button" onClick={()=>{setDraft(editable(lesson));setMessage("");setSaveError("")}}>Cancel</button><button className="primary" disabled={saving}>{saving?"Saving...":"Save"}</button></footer></form>
      {lesson.resources?.length>0&&<section className="lesson-resource-status-list" aria-label="Existing supporting resources">{lesson.resources.filter((resource)=>String(primary?.resourceId)!==String(resource._id)).map((resource)=><div key={resource._id}><div><strong>{resource.originalName}</strong><small>{fileType(resource)} · {formatFileSize(resource.size)} · {isMediaResource(resource)?"Supporting video":"Supporting resource"}</small></div><span>{canPreviewResource(resource)&&<button type="button" onClick={()=>accessResource(resource,"view")}>View</button>}<button type="button" onClick={()=>accessResource(resource,"download")}>Download</button>{isMediaResource(resource)&&<button type="button" onClick={()=>selectMain(lesson._id,resource._id)}>Set as main</button>}<button type="button" onClick={()=>removeResource(lesson._id,resource._id)}>Delete</button></span></div>)}</section>}
    </>}
  </main><aside><header><h2>Course content</h2><span>{course.lessons.length} lessons</span></header>{course.lessons.map((item,index)=><button className={selected===index?"active":""} onClick={()=>{setSelected(index);setDraft(editable(item));setMessage("");setSaveError("")}} key={item._id}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item.title}</strong><small>{getLessonPrimaryMedia(item)?"Main video":"No video"} · {item.resources?.length||0} resources</small></div><i onClick={(event)=>{event.stopPropagation();remove(item._id)}}>Delete</i></button>)}</aside></div>
  {modalOpen&&<div className="lesson-modal-overlay" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)closeModal()}}><section className="lesson-modal" role="dialog" aria-modal="true" aria-labelledby="add-lesson-title"><header><div><small>COURSE CONTENT</small><h2 id="add-lesson-title">Add Lesson</h2></div><button type="button" aria-label="Close Add Lesson" onClick={closeModal}><FaTimes/></button></header><form onSubmit={createLesson}><div className="lesson-upload-grid">
    <UploadCard kind="video" title="Upload lesson video" hint="MP4, WebM or Ogg · one file" accept={mediaAccept} files={form.mainVideo?[form.mainVideo]:[]} onFiles={(files)=>{const chosen=validateFiles(files,mediaExtensions,true);if(chosen[0])setForm({...form,mainVideo:chosen[0]})}} onRemove={()=>setForm({...form,mainVideo:null})}/>
    <UploadCard kind="documents" title="Upload documents" hint="PDF, Office, TXT, images and additional media" accept={resourceAccept} multiple files={form.resources} onFiles={(files)=>setForm({...form,resources:[...form.resources,...validateFiles(files,resourceExtensions)]})} onRemove={(index)=>setForm({...form,resources:form.resources.filter((_,item)=>item!==index)})}/>
  </div><LessonFields value={form} setValue={setForm}/><QuizEditor courseId={course._id} quiz={form.quiz} setQuiz={(quiz) => setForm((current)=>({...current, quiz}))}/>{saveError&&<p className="lesson-form-error" role="alert">{saveError}</p>}<footer><button type="button" onClick={closeModal}>Cancel</button><button className="primary" disabled={saving}>{saving?"Saving lesson...":"Save Lesson"}</button></footer></form></section></div>}
  </div>;
}

import { useRef, useState } from "react";
import { FaCloudUploadAlt, FaTrash } from "react-icons/fa";
import AuthedMedia from "./AuthedMedia";
import "../styles/QuizAttachment.css";
import { formatFileSize } from "../utils/lessonMedia";
import { QUIZ_MEDIA_ACCEPT, checkQuizMediaFile, deleteQuizMedia, tutorQuizMediaUrl, uploadQuizMedia } from "../utils/quizMedia";

// Tutor-side: attach one picture or audio clip to a quiz question.
// The file is uploaded as soon as it is chosen; the quiz form then only keeps
// the small descriptor the server returned.
export default function QuizAttachment({ courseId, media, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file) => {
    if (!file || busy) return;
    const problem = checkQuizMediaFile(file);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError("");
    try {
      const { media: uploaded } = await uploadQuizMedia(courseId, file);
      if (media) deleteQuizMedia(courseId, media.storedName);
      onChange(uploaded);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  };

  const pick = () => {
    if (!input.current) return;
    input.current.value = "";
    input.current.click();
  };

  const remove = () => {
    deleteQuizMedia(courseId, media.storedName);
    onChange(null);
    setError("");
  };

  return (
    <div className="quiz-attach">
      <span className="quiz-attach-label">Picture or audio (optional)</span>
      <input ref={input} type="file" accept={QUIZ_MEDIA_ACCEPT} style={{ display: "none" }} onChange={(event) => upload(event.target.files?.[0])} />

      {media ? (
        <div className="quiz-attach-card">
          <div className="quiz-attach-preview">
            <AuthedMedia url={tutorQuizMediaUrl(courseId, media.storedName)} kind={media.kind} name={media.originalName} />
          </div>
          <div className="quiz-attach-info">
            <strong title={media.originalName}>{media.originalName}</strong>
            <small>{media.kind === "audio" ? "Audio" : "Picture"} · {formatFileSize(media.size)}</small>
          </div>
          <div className="quiz-attach-actions">
            <button type="button" className="lesson-quiz-ghost" onClick={pick} disabled={busy}>{busy ? "Uploading..." : "Replace"}</button>
            <button type="button" className="lesson-quiz-ghost danger" onClick={remove} disabled={busy}><FaTrash /> Remove</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="quiz-attach-dropzone"
          disabled={busy}
          onClick={pick}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); upload(event.dataTransfer.files?.[0]); }}
        >
          <FaCloudUploadAlt aria-hidden="true" />
          <strong>{busy ? "Uploading..." : "Add a picture or audio clip"}</strong>
          <small>Drag and drop or browse · JPG, PNG, GIF, WebP up to 5 MB · MP3, WAV, M4A, OGG up to 15 MB</small>
        </button>
      )}

      {error && <p className="quiz-attach-error" role="alert">{error}</p>}
    </div>
  );
}

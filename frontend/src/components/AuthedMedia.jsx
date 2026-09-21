import { useEffect, useState } from "react";
import "../styles/AuthedMedia.css";

// Shows a picture or audio clip that sits behind a login. <img> and <audio>
// cannot send an Authorization header, so the file is fetched with the token
// and shown from a temporary blob URL.
export default function AuthedMedia({ url, kind, name }) {
  const [state, setState] = useState({ url: "", src: "", failed: false });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("unavailable"); return response.blob(); })
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setState({ url, src: objectUrl, failed: false }); })
      .catch((error) => { if (error.name !== "AbortError") setState({ url, src: "", failed: true }); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  if (state.url !== url) return <div className="authed-media-note">Loading...</div>;
  if (state.failed) return <div className="authed-media-note">This attachment could not be loaded.</div>;
  return kind === "audio"
    ? <audio className="authed-media-audio" controls src={state.src} aria-label={name || "Question audio"} />
    : <img className="authed-media-image" src={state.src} alt={name || "Question attachment"} />;
}

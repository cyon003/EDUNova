export function formatMediaDuration(seconds) {
  const rounded = Math.ceil(Number(seconds));
  if (!Number.isFinite(rounded) || rounded <= 0) return "";
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function readMediaDuration(file) {
  return new Promise((resolve, reject) => {
    const media = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    const url = URL.createObjectURL(file);
    const finish = (seconds, error) => {
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute("src");
      media.load();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(seconds);
    };
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const seconds = Math.ceil(media.duration);
      if (!Number.isFinite(seconds) || seconds <= 0) finish(0, new Error("Could not read this media's duration."));
      else finish(seconds);
    };
    media.onerror = () => finish(0, new Error("This media format cannot be previewed in your browser."));
    media.src = url;
  });
}

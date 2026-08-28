const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function parseUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

export function isYouTubeUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && YOUTUBE_HOSTS.has(url.hostname.toLowerCase()));
}

export function getYouTubeVideoId(value) {
  const url = parseUrl(value);
  if (!url || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const hostname = url.hostname.toLowerCase();
  let candidate = "";
  if (hostname.endsWith("youtu.be")) {
    candidate = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (url.pathname === "/watch") {
    candidate = url.searchParams.get("v") || "";
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "embed", "live"].includes(parts[0])) candidate = parts[1] || "";
  }

  return VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

export function getYouTubeEmbedUrl(value) {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

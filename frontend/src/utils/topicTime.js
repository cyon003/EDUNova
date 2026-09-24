export function formatTopicTime(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return String(seconds ?? "");
  const milliseconds = Math.round(seconds * 1000);
  const minutes = Math.floor(milliseconds / 60000);
  const remainder = (milliseconds % 60000) / 1000;
  return `${String(minutes).padStart(2, "0")}:${remainder < 10 ? "0" : ""}${remainder}`;
}

export function parseTopicTime(value) {
  const match = /^(\d+):([0-5]\d(?:\.\d{1,3})?)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

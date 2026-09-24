export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthDays(month) {
  const year = month.getFullYear(), index = month.getMonth();
  return {
    offset: new Date(year, index, 1).getDay(),
    days: Array.from({ length: new Date(year, index + 1, 0).getDate() }, (_, day) => new Date(year, index, day + 1)),
  };
}

export function shiftMonth(month, delta) {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

// Existing planner entries are dated August entries, not recurring monthly events.
export const scheduledLessonDates = new Set(["2026-08-17", "2026-08-21", "2026-08-24", "2026-08-28"]);


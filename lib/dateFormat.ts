/** YYYY-MM-DD in local timezone (avoid UTC shift from toISOString) */
export function toLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addLocalDays(d: Date, deltaDays: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + deltaDays);
  return copy;
}

/**
 * Global date format: DD/MM/YYYY
 */
export function formatDateDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date.includes("T") ? date : date + "T12:00:00") : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}:${month}:${year}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** e.g. 04 April (for stock in/out rows) */
export function formatDayMonthName(date: Date | string): string {
  const d =
    typeof date === "string"
      ? new Date(date.includes("T") ? date : date + "T12:00:00")
      : date;
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${MONTH_NAMES[d.getMonth()]}`;
}

/** e.g. 06 April 2026 (Excel / report export) */
export function formatDayMonthYear(date: Date | string): string {
  const d =
    typeof date === "string"
      ? new Date(date.includes("T") ? date : date + "T12:00:00")
      : date;
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Local time HH:MM for a transaction row */
export function formatTimeHHMM(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

/** With optional time for datetime values */
export function formatDateTimeDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = formatDateDDMMYYYY(d);
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} ${hours}:${mins}`;
}

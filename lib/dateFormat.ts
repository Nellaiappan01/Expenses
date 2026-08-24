/** YYYY-MM-DD for `<input type="date">` (avoids UTC shift from toISOString). */
export function toDateInputValue(date: Date | string): string {
  if (typeof date === "string") {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const d = parseLocalDate(date);
  return d ? toLocalDateString(d) : "";
}

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

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

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

function parseLocalDate(date: Date | string): Date | null {
  const d =
    typeof date === "string"
      ? new Date(date.includes("T") ? date : `${date.trim()}T12:00:00`)
      : date;
  return Number.isNaN(d.getTime()) ? null : d;
}

export type FormatDateOptions = {
  /** Include weekday prefix (Mon). Default true. */
  weekday?: boolean;
};

/**
 * Preferred format: Mon 16 Jun 2026
 * Without weekday: 16 Jun 2026
 */
export function formatDateDisplay(
  date: Date | string,
  options: FormatDateOptions = {}
): string {
  const d = parseLocalDate(date);
  if (!d) return "";

  const weekday = options.weekday !== false;
  const day = d.getDate();
  const month = MONTH_SHORT[d.getMonth()];
  const year = d.getFullYear();

  if (weekday) {
    return `${WEEKDAY_SHORT[d.getDay()]} ${day} ${month} ${year}`;
  }
  return `${day} ${month} ${year}`;
}

/** App-wide date display (alias). e.g. Mon 16 Jun 2026 */
export function formatDateDDMMYYYY(date: Date | string): string {
  return formatDateDisplay(date);
}

/** Google Sheets & exports — same readable format. */
export function formatIsoDateForSheet(isoDate: string): string {
  return formatDateDisplay(isoDate);
}

/** e.g. 04 April (for stock in/out rows) */
export function formatDayMonthName(date: Date | string): string {
  const d = parseLocalDate(date);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${MONTH_NAMES[d.getMonth()]}`;
}

/** e.g. 16 Jun 2026 (Excel / report export) */
export function formatDayMonthYear(date: Date | string): string {
  return formatDateDisplay(date, { weekday: false });
}

/** Inclusive calendar days between two YYYY-MM-DD values. */
export function inclusiveDayCount(from: string, to: string): number {
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (!start || !end) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

/** Compact range for chips and headers: 3 Aug 2026 – 5 Aug 2026 */
export function formatDateRangeLabel(from?: string, to?: string): string {
  if (!from && !to) return "All dates";
  if (from && to && from !== to) {
    return `${formatDateDisplay(from, { weekday: false })} – ${formatDateDisplay(to, { weekday: false })}`;
  }
  return formatDateDisplay(from || to || "");
}

/** Local time HH:MM for a transaction row */
export function formatTimeHHMM(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

/** e.g. Mon 16 Jun 2026 14:30 */
export function formatDateTimeDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const datePart = formatDateDisplay(d);
  return `${datePart} ${formatTimeHHMM(d)}`;
}

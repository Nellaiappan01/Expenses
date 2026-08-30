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

/** Numeric form display: 30-08-2026 from YYYY-MM-DD */
export function formatIsoDateDdMmYyyy(isoDate: string): string {
  const trimmed = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const [y, m, d] = trimmed.split("-");
  return `${d}-${m}-${y}`;
}

/** Parse DD-MM-YYYY (also accepts / or .) to YYYY-MM-DD */
export function parseDdMmYyyyToIsoDate(display: string): string | null {
  const trimmed = display.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000) return null;

  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

  return toLocalDateString(d);
}

/** Auto-insert dashes while typing DD-MM-YYYY */
export function maskDdMmYyyyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
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

/** Google Drive date folder — matches Drive UI e.g. 01 Aug 2026 */
export function formatDriveDateFolderName(date: Date | string): string {
  const d = parseLocalDate(date);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
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

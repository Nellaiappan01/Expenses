import type { Entry } from "./types";

export type TrackSummaryFilters = {
  from: string;
  to: string;
  requestedBy: string;
  category: string;
  approvedBy: string;
  method: string;
  tag: string;
  search: string;
};

export type AmountBreakdownRow = {
  label: string;
  amount: number;
  count: number;
};

export type PaymentLine = {
  date: string;
  category: string;
  amount: number;
};

export type TrackSummaryStats = {
  totalAmount: number;
  totalEntries: number;
  categoryBreakdown: AmountBreakdownRow[];
  payments: PaymentLine[];
};

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

let shareInFlight = false;

export function formatSummaryCurrency(amount: number): string {
  return `₹${Math.abs(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
}

function formatPeriodDate(iso: string): string {
  const d = new Date(`${iso.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPaymentDate(iso: string): string {
  const d = new Date(`${iso.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${MONTH_SHORT[d.getMonth()]}`;
}

export function formatSummaryPeriod(from: string, to: string): string | null {
  const f = from.trim();
  const t = to.trim();
  if (f && t) return `${formatPeriodDate(f)} – ${formatPeriodDate(t)}`;
  if (f) return `From ${formatPeriodDate(f)}`;
  if (t) return `Until ${formatPeriodDate(t)}`;
  return null;
}

export function paymentTypeLabel(method: string): string {
  if (method === "Bank") return "Bank A/c";
  return method || "Other";
}

function sortEntriesChronologically(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

/** Merge categories case-insensitively (e.g. "T block" + "T Block" → one row). */
function groupCategories(entries: Entry[]): AmountBreakdownRow[] {
  const map = new Map<
    string,
    { label: string; labelVotes: Map<string, number>; amount: number; count: number }
  >();

  for (const entry of entries) {
    const raw = entry.category?.trim() || "Other";
    const key = raw.toLowerCase();
    const amount = Math.abs(entry.amount);

    let row = map.get(key);
    if (!row) {
      row = { label: raw, labelVotes: new Map(), amount: 0, count: 0 };
      map.set(key, row);
    }

    row.amount += amount;
    row.count += 1;
    row.labelVotes.set(raw, (row.labelVotes.get(raw) ?? 0) + 1);

    const topLabel = [...row.labelVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topLabel) row.label = topLabel;
  }

  return [...map.values()]
    .map(({ label, amount, count }) => ({ label, amount, count }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

export function buildTrackSummaryStats(entries: Entry[]): TrackSummaryStats {
  const sorted = sortEntriesChronologically(entries);
  const totalAmount = sorted.reduce((sum, e) => sum + Math.abs(e.amount), 0);

  return {
    totalAmount,
    totalEntries: sorted.length,
    categoryBreakdown: groupCategories(sorted),
    payments: sorted.map((e) => ({
      date: formatPaymentDate(e.date),
      category: e.category?.trim() || "Other",
      amount: Math.abs(e.amount),
    })),
  };
}

export function buildTrackWhatsAppSummary(
  appName: string,
  filters: TrackSummaryFilters,
  stats: TrackSummaryStats
): string {
  const lines: string[] = [];
  const brand = appName.trim() || "Site Ledger";

  lines.push(`*${brand} – Payment Summary*`);
  lines.push("");

  if (filters.requestedBy.trim()) {
    lines.push(`*Requested By:* ${filters.requestedBy.trim()}`);
  }
  if (filters.category.trim()) {
    lines.push(`*Category:* ${filters.category.trim()}`);
  }
  if (filters.approvedBy.trim()) {
    lines.push(`*Approved By:* ${filters.approvedBy.trim()}`);
  }
  if (filters.method.trim()) {
    lines.push(`*Payment Type:* ${paymentTypeLabel(filters.method.trim())}`);
  }
  if (filters.tag.trim()) {
    lines.push(`*Tag:* ${filters.tag.trim()}`);
  }
  if (filters.search.trim()) {
    lines.push(`*Search:* ${filters.search.trim()}`);
  }

  const period = formatSummaryPeriod(filters.from, filters.to);
  if (period) {
    lines.push(`*Period:* ${period}`);
  }

  lines.push("");
  lines.push(`*Total Amount:* ${formatSummaryCurrency(stats.totalAmount)}`);

  if (stats.payments.length > 0) {
    lines.push("");
    lines.push("*Payments:*");
    for (const payment of stats.payments) {
      lines.push(
        `${payment.date} - ${payment.category} - ${formatSummaryCurrency(payment.amount)}`
      );
    }
  }

  const showCategorySummary =
    !filters.category.trim() && stats.categoryBreakdown.length > 0;

  if (showCategorySummary) {
    lines.push("");
    lines.push("*Category Summary*");
    for (const row of stats.categoryBreakdown) {
      lines.push(`${row.label}: ${formatSummaryCurrency(row.amount)}`);
    }
    lines.push("");
    lines.push(`*Total: ${formatSummaryCurrency(stats.totalAmount)}*`);
  }

  lines.push("");
  lines.push(`_Generated from ${brand}_`);

  return lines.join("\n");
}

export function shareTrackSummaryOnWhatsApp(text: string): boolean {
  if (shareInFlight) return false;
  shareInFlight = true;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");

  window.setTimeout(() => {
    shareInFlight = false;
  }, 2500);

  return true;
}

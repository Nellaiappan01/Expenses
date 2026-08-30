import type { Entry } from "./types";
import { isAwaitingApprover, isAwaitingPayment, isLegacyWorkflowEntry } from "./paymentWorkflow";

export type TrackSummaryFilters = {
  from: string;
  to: string;
  requestedBy: string;
  category: string;
  approvedBy: string;
  paidVia: string;
  search: string;
  workflowStatus: string;
  sheetsSync: string;
};

function sheetsSyncLabel(value: string): string {
  switch (value.trim()) {
    case "pending":
      return "Pending sync";
    case "failed":
      return "Sync failed";
    default:
      return value.trim();
  }
}

function workflowStatusLabel(value: string): string {
  switch (value.trim()) {
    case "approval_pending":
      return "Pending Approval";
    case "payment_pending":
      return "Payment Pending";
    case "paid":
      return "Paid / Verified";
    default:
      return value.trim();
  }
}

export type AmountBreakdownRow = {
  label: string;
  amount: number;
  count: number;
};

export type PaymentLine = {
  date: string;
  requestedBy: string;
  category: string;
  amount: number;
  note?: string;
};

export type WorkflowBucketTotals = {
  amount: number;
  count: number;
};

export type WorkflowTotals = {
  pendingApproval: WorkflowBucketTotals;
  paymentPending: WorkflowBucketTotals;
  paidVerified: WorkflowBucketTotals;
};

export type TrackSummaryStats = {
  totalAmount: number;
  totalEntries: number;
  categoryBreakdown: AmountBreakdownRow[];
  requestedByBreakdown: AmountBreakdownRow[];
  payments: PaymentLine[];
  workflowTotals: WorkflowTotals;
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

type WorkflowBucket = "pending_approval" | "payment_pending" | "paid";

function expenseWorkflowBucket(entry: Entry): WorkflowBucket | null {
  if (entry.type !== "expense") return null;
  if (entry.isNil) return null;
  if (entry.approvalStatus === "rejected") return null;
  if (isLegacyWorkflowEntry(entry)) return "paid";
  if (entry.paymentStatus === "paid") return "paid";
  if (isAwaitingApprover(entry)) return "pending_approval";
  if (isAwaitingPayment(entry)) return "payment_pending";
  return "paid";
}

export function buildWorkflowTotals(entries: Entry[]): WorkflowTotals {
  const totals: WorkflowTotals = {
    pendingApproval: { amount: 0, count: 0 },
    paymentPending: { amount: 0, count: 0 },
    paidVerified: { amount: 0, count: 0 },
  };

  for (const entry of entries) {
    const bucket = expenseWorkflowBucket(entry);
    if (!bucket) continue;
    const amount = Math.abs(entry.amount);
    if (bucket === "pending_approval") {
      totals.pendingApproval.amount += amount;
      totals.pendingApproval.count += 1;
    } else if (bucket === "payment_pending") {
      totals.paymentPending.amount += amount;
      totals.paymentPending.count += 1;
    } else {
      totals.paidVerified.amount += amount;
      totals.paidVerified.count += 1;
    }
  }

  return totals;
}

/** Footer / share total for the selected Pending, To pay, or Paid tab — expenses only. */
export function workflowSectionTotal(
  workflowStatus: string,
  totals: WorkflowTotals
): { label: string; amount: number; count: number; tone: "gold" | "brand"; icon: "pending" | "pay" | "paid" } {
  if (workflowStatus === "approval_pending") {
    return {
      label: "Pending total",
      amount: totals.pendingApproval.amount,
      count: totals.pendingApproval.count,
      tone: "brand",
      icon: "pending",
    };
  }
  if (workflowStatus === "payment_pending") {
    return {
      label: "To pay total",
      amount: totals.paymentPending.amount,
      count: totals.paymentPending.count,
      tone: "gold",
      icon: "pay",
    };
  }
  if (workflowStatus === "paid") {
    return {
      label: "Paid total",
      amount: totals.paidVerified.amount,
      count: totals.paidVerified.count,
      tone: "brand",
      icon: "paid",
    };
  }
  return {
    label: "Expense total",
    amount:
      totals.pendingApproval.amount + totals.paymentPending.amount + totals.paidVerified.amount,
    count: totals.pendingApproval.count + totals.paymentPending.count + totals.paidVerified.count,
    tone: "brand",
    icon: "paid",
  };
}

/** Merge requested-by names case-insensitively. */
function groupRequestedBy(entries: Entry[]): AmountBreakdownRow[] {
  const map = new Map<
    string,
    { label: string; labelVotes: Map<string, number>; amount: number; count: number }
  >();

  for (const entry of entries) {
    const raw = entry.name?.trim() || "Unknown";
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

function workflowLine(label: string, row: WorkflowBucketTotals): string {
  const countSuffix = row.count > 0 ? ` (${row.count})` : "";
  return `- ${label}: ${formatSummaryCurrency(row.amount)}${countSuffix}`;
}

export function buildTrackSummaryStats(entries: Entry[]): TrackSummaryStats {
  const sorted = sortEntriesChronologically(entries);
  const workflowTotals = buildWorkflowTotals(sorted);
  const totalAmount =
    workflowTotals.pendingApproval.amount +
    workflowTotals.paymentPending.amount +
    workflowTotals.paidVerified.amount;
  const totalEntries =
    workflowTotals.pendingApproval.count +
    workflowTotals.paymentPending.count +
    workflowTotals.paidVerified.count;

  return {
    totalAmount,
    totalEntries,
    categoryBreakdown: groupCategories(sorted.filter((e) => e.type === "expense")),
    requestedByBreakdown: groupRequestedBy(sorted.filter((e) => e.type === "expense")),
    payments: sorted
      .filter((e) => e.type === "expense")
      .map((e) => ({
        date: formatPaymentDate(e.date),
        requestedBy: e.name?.trim() || "Unknown",
        category: e.category?.trim() || "Other",
        amount: Math.abs(e.amount),
        note: e.note?.trim() || undefined,
      })),
    workflowTotals,
  };
}

export function buildTrackWhatsAppSummary(
  appName: string,
  filters: TrackSummaryFilters,
  stats: TrackSummaryStats
): string {
  const lines: string[] = [];
  const brand = appName.trim() || "Site Ledger";
  const divider = "────────────────";

  lines.push(`*${brand} – Payment Summary*`);
  lines.push(divider);
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
  if (filters.paidVia.trim()) {
    const labels: Record<string, string> = {
      Cash: "Cash",
      GPay: "GPay / UPI",
      Bank: "Bank transfer",
    };
    lines.push(`*Paid via:* ${labels[filters.paidVia.trim()] ?? filters.paidVia.trim()}`);
  }
  if (filters.search.trim()) {
    lines.push(`*Search:* ${filters.search.trim()}`);
  }
  if (filters.workflowStatus.trim()) {
    lines.push(`*Status filter:* ${workflowStatusLabel(filters.workflowStatus)}`);
  }
  if (filters.sheetsSync.trim()) {
    lines.push(`*Sheets sync:* ${sheetsSyncLabel(filters.sheetsSync)}`);
  }

  const period = formatSummaryPeriod(filters.from, filters.to);
  if (period) {
    lines.push(`*Period:* ${period}`);
  }

  const { workflowTotals } = stats;

  lines.push("");
  lines.push("*Overview*");
  lines.push(`- Total Amount: ${formatSummaryCurrency(stats.totalAmount)}`);
  lines.push(workflowLine("Pending Approval", workflowTotals.pendingApproval));
  lines.push(workflowLine("Payment Pending", workflowTotals.paymentPending));
  lines.push(workflowLine("Paid / Verified", workflowTotals.paidVerified));

  const showRequestedBySummary =
    !filters.requestedBy.trim() && stats.requestedByBreakdown.length > 0;

  if (showRequestedBySummary) {
    lines.push("");
    lines.push("*Requested By Summary*");
    for (const row of stats.requestedByBreakdown) {
      const countSuffix = row.count > 1 ? ` (${row.count})` : "";
      lines.push(`- ${row.label}: ${formatSummaryCurrency(row.amount)}${countSuffix}`);
    }
  }

  if (stats.payments.length > 0) {
    lines.push("");
    lines.push(divider);
    lines.push("*Payments*");
    for (const payment of stats.payments) {
      const noteSuffix = payment.note ? ` - ${payment.note}` : "";
      lines.push(
        `- ${payment.date} | ${payment.requestedBy} | ${payment.category} | ${formatSummaryCurrency(payment.amount)}${noteSuffix}`
      );
    }
  }

  const showCategorySummary =
    !filters.category.trim() && stats.categoryBreakdown.length > 0;

  if (showCategorySummary) {
    lines.push("");
    lines.push("*Category Summary*");
    for (const row of stats.categoryBreakdown) {
      lines.push(`- ${row.label}: ${formatSummaryCurrency(row.amount)}`);
    }
  }

  lines.push("");
  lines.push(divider);
  lines.push(`_${brand} · ${stats.totalEntries} entr${stats.totalEntries === 1 ? "y" : "ies"}_`);

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

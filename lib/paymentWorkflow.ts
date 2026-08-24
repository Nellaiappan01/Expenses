import type { ApprovalStatus, Entry, PaymentStatus, PaymentVerifiedMethod } from "./types";

/** Legacy entries (no workflow fields) behave as approved + paid. */
export function isLegacyWorkflowEntry(entry: {
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
}): boolean {
  return !entry.approvalStatus && !entry.paymentStatus;
}

/** Whether an expense amount should affect wallet balance / paid totals. */
export function expenseCountsInBalance(entry: Pick<Entry, "type" | "paymentStatus">): boolean {
  if (entry.type !== "expense") return true;
  const status = entry.paymentStatus ?? "paid";
  return status === "paid";
}

export function approvalStatusLabel(status?: ApprovalStatus): string {
  if (!status || status === "pending") return "Pending Approval";
  if (status === "approved") return "Approved";
  return "Rejected";
}

export function paymentStatusLabel(status?: PaymentStatus): string {
  if (!status || status === "pending") return "Payment Pending";
  return "Paid / Verified";
}

export function paymentStatusEmoji(status?: PaymentStatus): string {
  if (!status || status === "pending") return "💳";
  return "✓";
}

/** Badge colors + labels for each workflow stage (expenses only). */
export function workflowBadgeMeta(entry: {
  type?: string;
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
}): {
  label: string;
  className: string;
  icon: "pending_approval" | "payment_pending" | "paid" | "rejected";
} | null {
  if (entry.type !== "expense") return null;
  if (!entry.approvalStatus && !entry.paymentStatus) return null;

  if (entry.approvalStatus === "pending") {
    return {
      label: "Pending Approval",
      className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
      icon: "pending_approval",
    };
  }
  if (entry.approvalStatus === "rejected") {
    return {
      label: "Rejected",
      className: "bg-red-50 text-red-800 ring-1 ring-red-200/70",
      icon: "rejected",
    };
  }
  if (entry.paymentStatus === "paid") {
    return {
      label: "Paid",
      className: "bg-[#0B4A8C]/10 text-[#0B4A8C] ring-1 ring-[#0B4A8C]/15",
      icon: "paid",
    };
  }
  return {
    label: "Payment Pending",
    className: "bg-[#C9A227]/12 text-[#7A5E10] ring-1 ring-[#C9A227]/25",
    icon: "payment_pending",
  };
}

export function requestLabel(entry: Pick<Entry, "note" | "category" | "name">): string {
  return entry.note?.trim() || entry.category?.trim() || entry.name;
}

export function formatPaymentVerifiedMethod(method?: PaymentVerifiedMethod): string {
  if (method === "Bank Transfer") return "Bank Transfer";
  if (method === "GPay / UPI") return "GPay / UPI";
  if (method === "Cash") return "Cash";
  return method ?? "";
}

/** Human-readable payment workflow status for Google Sheets column K. */
export function formatSheetPaymentStatus(entry: {
  type?: string;
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
}): string {
  if (entry.type !== "expense") return "";
  if (isLegacyWorkflowEntry(entry)) return "Paid / Verified";
  if (entry.approvalStatus === "pending") return "Pending Approval";
  if (entry.approvalStatus === "rejected") return "Rejected";
  if (entry.paymentStatus === "paid") return "Paid / Verified";
  return "Payment Pending";
}

/** Users may edit/delete workflow expenses only while awaiting admin approval. */
export function canUserModifyEntry(entry: {
  type?: string;
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
}): boolean {
  if (entry.type !== "expense") return true;
  if (isLegacyWorkflowEntry(entry)) return true;
  return entry.approvalStatus === "pending";
}

export function entryModifyLockReason(entry: {
  type?: string;
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
}): string | null {
  if (canUserModifyEntry(entry)) return null;
  if (entry.approvalStatus === "rejected") {
    return "This request was rejected and cannot be changed.";
  }
  if (entry.paymentStatus === "paid") {
    return "Admin marked this as paid / verified. Date, amount, and other fields cannot be changed.";
  }
  if (entry.approvalStatus === "approved") {
    return "Approved on site — waiting for admin payment. Date and amount cannot be changed until then.";
  }
  return "This entry cannot be changed.";
}

/** Short status for lists — words instead of a lock icon. */
export function entryLockShortLabel(entry: {
  type?: string;
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
}): string | null {
  if (canUserModifyEntry(entry)) return null;
  if (entry.paymentStatus === "paid") return "Paid / verified — cannot edit";
  if (entry.approvalStatus === "rejected") return "Rejected — cannot edit";
  if (entry.approvalStatus === "approved") return "Waiting payment — cannot edit";
  return "Cannot edit";
}

/** MongoDB $cond expression: sum expense only when paid (legacy = paid). */
export const EXPENSE_BALANCE_COND = {
  $and: [
    { $eq: ["$type", "expense"] },
    { $eq: [{ $ifNull: ["$paymentStatus", "paid"] }, "paid"] },
  ],
} as const;

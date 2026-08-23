import type { EntryType } from "./types";

export type EntryListItem = {
  type: EntryType;
  amount: number;
  deleted?: boolean;
  isEdited?: boolean;
};

/** Signed display amount with type-aware prefix. */
export function formatEntryAmount(amount: number, type: EntryType): string {
  const formatted = Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  if (type === "rotation_cash") {
    return amount >= 0 ? `+₹${formatted}` : `-₹${formatted}`;
  }
  if (type === "adjustment") {
    return amount >= 0 ? `+₹${formatted}` : `-₹${formatted}`;
  }
  if (type === "expense" || type === "worker_payment") {
    return `-₹${formatted}`;
  }
  return amount >= 0 ? `+₹${formatted}` : `-₹${formatted}`;
}

export function entryAmountColorClass(entry: EntryListItem): string {
  if (entry.deleted) return "text-red-400 line-through";

  switch (entry.type) {
    case "rotation_cash":
      return entry.amount >= 0
        ? "text-[#0B4A8C] dark:text-sky-400"
        : "text-red-600 dark:text-red-400";
    case "adjustment":
      return entry.amount >= 0
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
    case "expense":
    case "worker_payment":
      return "text-emerald-600 dark:text-emerald-400";
    default:
      return entry.amount >= 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";
  }
}

export function entryRowClass(entry: EntryListItem): string {
  if (entry.deleted) {
    return "border-red-200 bg-red-50/60";
  }
  return "border-zinc-200 bg-white";
}

export function entryTypeLabel(type: EntryType): string {
  if (type === "rotation_cash") return "Wallet";
  if (type === "worker_payment") return "Worker";
  if (type === "adjustment") return "Adjustment";
  return "Expense";
}

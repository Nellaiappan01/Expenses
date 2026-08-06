import type { EntryType } from "./types";

/** Money in (green): wallet inflows and positive adjustments. */
export function isEntryInflow(type: EntryType, amount: number): boolean {
  if (type === "rotation_cash") return true;
  if (type === "expense" || type === "worker_payment") return false;
  if (type === "adjustment") return amount >= 0;
  return amount >= 0;
}

export function entryAmountColorClass(type: EntryType, amount: number): string {
  return isEntryInflow(type, amount) ? "text-emerald-600" : "text-red-600";
}

export function formatEntryAmount(amount: number, type: EntryType): string {
  const inflow = isEntryInflow(type, amount);
  const sign = inflow ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

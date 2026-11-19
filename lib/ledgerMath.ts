import type { ApprovalStatus, EntryType, PaymentStatus } from "./types";

export type LedgerMovement = {
  type: EntryType | string;
  amount: number;
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
  isNil?: boolean;
  deleted?: boolean;
  date?: string;
  createdAt?: Date | string;
  _id?: string;
};

/** Rupees to integer paise. Does not write anything back to stored entries. */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Signed paise effect on the closing balance.
 * Pending and rejected expenses do not move the balance.
 * A legacy expense with no payment status counts as paid.
 * Nil and deleted rows do not move the balance.
 */
export function entryEffectPaise(entry: LedgerMovement): number {
  if (entry.deleted) return 0;
  if (entry.isNil) return 0;

  switch (entry.type) {
    case "rotation_cash":
    case "adjustment":
      return toPaise(entry.amount);
    case "worker_payment":
      return -toPaise(Math.abs(entry.amount));
    case "expense": {
      if (entry.approvalStatus === "rejected") return 0;
      const status = entry.paymentStatus ?? "paid";
      if (status !== "paid") return 0;
      return -toPaise(Math.abs(entry.amount));
    }
    default:
      return 0;
  }
}

export function entryEffectRupees(entry: LedgerMovement): number {
  return fromPaise(entryEffectPaise(entry));
}

export function sumEffectPaise(entries: LedgerMovement[]): number {
  return entries.reduce((sum, entry) => sum + entryEffectPaise(entry), 0);
}

/** Closing = opening + received − outflows, in paise. */
export function closingPaise(openingPaise: number, entries: LedgerMovement[]): number {
  return openingPaise + sumEffectPaise(entries);
}

export type RunningRow = {
  openingPaise: number;
  effectPaise: number;
  closingPaise: number;
};

export function compareLedgerOrder(a: LedgerMovement, b: LedgerMovement): number {
  const dateCmp = (a.date ?? "").localeCompare(b.date ?? "");
  if (dateCmp !== 0) return dateCmp;
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (aTime !== bTime) return aTime - bTime;
  return String(a._id ?? "").localeCompare(String(b._id ?? ""));
}

/** Running balance in calendar order. A backdated row is placed by its date. */
export function runningBalances(entries: LedgerMovement[], openingPaise = 0): RunningRow[] {
  const sorted = [...entries].sort(compareLedgerOrder);
  let balance = openingPaise;
  return sorted.map((entry) => {
    const opening = balance;
    const effect = entryEffectPaise(entry);
    balance += effect;
    return { openingPaise: opening, effectPaise: effect, closingPaise: balance };
  });
}

export type ChainInput = {
  expensePaise: number;
  addonPaise: number;
  countsExpense: boolean;
};

/**
 * Sheet chain used by an active period tab.
 * The opening anchor is an input and is never replaced with zero.
 */
export function chainFromAnchor(anchorPaise: number, rows: ChainInput[]): RunningRow[] {
  let balance = anchorPaise;
  return rows.map((row) => {
    const opening = balance;
    const expense = row.countsExpense ? row.expensePaise : 0;
    const effect = row.addonPaise - expense;
    balance += effect;
    return { openingPaise: opening, effectPaise: effect, closingPaise: balance };
  });
}

/** Sheet payment-status text that reduces the active-period closing. */
export function sheetStatusCountsExpense(status: string): boolean {
  const label = status.trim();
  if (label === "Rejected" || label === "Pending Approval" || label === "Payment Pending" || label === "Nil") {
    return false;
  }
  return true;
}

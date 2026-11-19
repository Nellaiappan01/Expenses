import { buildSheetsPayload } from "./googleSheetsSync";
import { compareLedgerOrder, entryEffectRupees } from "./ledgerMath";
import type { Entry } from "./types";

/** Signed change to the closing balance. Same rules as the home card and the active sheet tab. */
export function entryBalanceDelta(entry: Entry): number {
  return entryEffectRupees(entry);
}

export function sortEntriesChronologically(entries: Entry[]): Entry[] {
  return [...entries].sort(compareLedgerOrder);
}

export function sumBalanceDeltas(entries: Entry[]): number {
  return entries.reduce((sum, e) => sum + entryBalanceDelta(e), 0);
}

export type LedgerRow = {
  date: string;
  openingBalance: number;
  category: string;
  expensesAmount: number;
  notes: string;
  addOn: number;
  source: string;
  closingBalance: number;
  requestedBy: string;
  approvedBy: string;
  paymentStatus: string;
};

export function buildLedgerRows(entries: Entry[], startingBalance = 0): LedgerRow[] {
  const sorted = sortEntriesChronologically(entries);
  let balance = startingBalance;
  const rows: LedgerRow[] = [];

  for (const e of sorted) {
    const opening = balance;
    const payload = buildSheetsPayload({
      type: e.type,
      date: e.date,
      name: e.name,
      category: e.category,
      amount: e.amount,
      method: e.method,
      note: e.note,
      bankName: e.bankName,
      approvedBy: e.approvedBy,
      approvalStatus: e.approvalStatus,
      paymentStatus: e.paymentStatus,
    });
    balance += entryBalanceDelta(e);
    rows.push({
      date: payload.date,
      openingBalance: opening,
      category: payload.category,
      expensesAmount: payload.expenseAmount,
      notes: payload.notes,
      addOn: payload.addOn,
      source: payload.source,
      closingBalance: balance,
      requestedBy: payload.requestedBy,
      approvedBy: payload.approvedBy,
      paymentStatus: payload.paymentStatus ?? "",
    });
  }

  return rows;
}

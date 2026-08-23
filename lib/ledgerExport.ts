import { buildSheetsPayload } from "./googleSheetsSync";
import type { Entry } from "./types";

/** Signed change to wallet balance for one entry. */
export function entryBalanceDelta(entry: Entry): number {
  switch (entry.type) {
    case "rotation_cash":
    case "adjustment":
      return entry.amount;
    case "expense":
    case "worker_payment":
      return -Math.abs(entry.amount);
    default:
      return 0;
  }
}

export function sortEntriesChronologically(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
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
    });
  }

  return rows;
}

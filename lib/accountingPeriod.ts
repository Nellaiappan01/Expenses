import { closingPaise, type LedgerMovement } from "./ledgerMath";

export type PeriodStatus = "open" | "closed";
export type SheetPolicy = "frozen_archive" | "active";

export type AccountingPeriod = {
  id: string;
  businessId: string;
  sequence: number;
  status: PeriodStatus;
  sheetPolicy: SheetPolicy;
  /** Inclusive YYYY-MM-DD. Null means the beginning of the books. */
  startDate: string | null;
  /** Inclusive YYYY-MM-DD. Null while the period is open. */
  endDate: string | null;
  openingPaise: number;
  closingPaise: number | null;
  formulaVersion: 1;
  sheetTabName: string | null;
  priorPeriodId: string | null;
};

export function entryInPeriod(date: string, period: Pick<AccountingPeriod, "startDate" | "endDate">): boolean {
  if (period.startDate && date < period.startDate) return false;
  if (period.endDate && date > period.endDate) return false;
  return true;
}

export function assertSingleOpenPeriod(periods: Pick<AccountingPeriod, "status">[]): void {
  const open = periods.filter((period) => period.status === "open").length;
  if (open > 1) {
    throw new Error("Only one accounting period can be open");
  }
}

/**
 * Close uses a compare-and-set on status "open".
 * A second caller sees "closed" and must not write another snapshot.
 */
export function claimPeriodClose(status: PeriodStatus): "claimed" | "rejected" {
  return status === "open" ? "claimed" : "rejected";
}

export function closePeriod(
  period: AccountingPeriod,
  entriesInPeriod: LedgerMovement[]
): AccountingPeriod {
  if (claimPeriodClose(period.status) === "rejected") {
    throw new Error("Period is already closed");
  }
  for (const entry of entriesInPeriod) {
    if (!entry.date || !entryInPeriod(entry.date, period)) {
      throw new Error("Entry date is outside the period being closed");
    }
  }
  return {
    ...period,
    status: "closed",
    sheetPolicy: "frozen_archive",
    closingPaise: closingPaise(period.openingPaise, entriesInPeriod),
  };
}

export function openNextPeriod(
  closed: AccountingPeriod,
  next: { id: string; nameTab: string; startDate: string }
): AccountingPeriod {
  if (closed.status !== "closed" || closed.closingPaise === null) {
    throw new Error("Carry-forward requires a stored closing snapshot");
  }
  return {
    id: next.id,
    businessId: closed.businessId,
    sequence: closed.sequence + 1,
    status: "open",
    sheetPolicy: "active",
    startDate: next.startDate,
    endDate: null,
    openingPaise: closed.closingPaise,
    closingPaise: null,
    formulaVersion: 1,
    sheetTabName: next.nameTab,
    priorPeriodId: closed.id,
  };
}

/** Dates inside a closed period are rejected. The archive tab is not recalculated. */
export function assertDateIsPostable(
  date: string,
  periods: AccountingPeriod[]
): { ok: true; period: AccountingPeriod } | { ok: false; error: string } {
  const closedHit = periods.find((period) => period.status === "closed" && entryInPeriod(date, period));
  if (closedHit) {
    return { ok: false, error: "That date is in a closed period. The stored closing balance was left unchanged." };
  }
  const open = periods.find((period) => period.status === "open" && entryInPeriod(date, period));
  if (!open) {
    return { ok: false, error: "No open accounting period covers that date" };
  }
  return { ok: true, period: open };
}

import type { EntryType } from "./types";

/**
 * Canonical amount for DB storage.
 * - expense / worker_payment: always positive (money out)
 * - rotation_cash / adjustment: signed (+ in, − out)
 */
export function normalizeStoredAmount(type: EntryType, amount: number): number {
  const n = Number(amount);
  if (Number.isNaN(n) || n === 0) return n;
  if (type === "expense" || type === "worker_payment") {
    return Math.abs(n);
  }
  return n;
}

/** Money leaving the wallet for balance / totals (always ≥ 0). */
export function entryOutflowAmount(type: EntryType, amount: number): number {
  if (type === "expense" || type === "worker_payment") {
    return Math.abs(amount);
  }
  if (type === "rotation_cash" && amount < 0) {
    return Math.abs(amount);
  }
  if (type === "adjustment" && amount < 0) {
    return Math.abs(amount);
  }
  return 0;
}

/** Money entering the wallet for balance / totals (always ≥ 0). */
export function entryInflowAmount(type: EntryType, amount: number): number {
  if (type === "rotation_cash" && amount > 0) {
    return amount;
  }
  if (type === "adjustment" && amount > 0) {
    return amount;
  }
  return 0;
}

/** MongoDB $group fields for wallet / expense totals (shared by balance & totals APIs). */
export const ENTRY_TOTALS_GROUP_FIELDS = {
  walletIn: {
    $sum: {
      $cond: [
        { $and: [{ $eq: ["$type", "rotation_cash"] }, { $gt: ["$amount", 0] }] },
        "$amount",
        0,
      ],
    },
  },
  walletOut: {
    $sum: {
      $cond: [
        { $and: [{ $eq: ["$type", "rotation_cash"] }, { $lt: ["$amount", 0] }] },
        { $abs: "$amount" },
        0,
      ],
    },
  },
  expense: {
    $sum: {
      $cond: [{ $eq: ["$type", "expense"] }, { $abs: "$amount" }, 0],
    },
  },
  workerPayment: {
    $sum: {
      $cond: [{ $eq: ["$type", "worker_payment"] }, { $abs: "$amount" }, 0],
    },
  },
  adjustment: {
    $sum: {
      $cond: [{ $eq: ["$type", "adjustment"] }, "$amount", 0],
    },
  },
} as const;

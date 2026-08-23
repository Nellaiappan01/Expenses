export type TotalsBreakdown = {
  walletIn: number;
  walletOut: number;
  expense: number;
  workerPayment: number;
  adjustment: number;
  received: number;
  paid: number;
  net: number;
};

export const EMPTY_TOTALS: TotalsBreakdown = {
  walletIn: 0,
  walletOut: 0,
  expense: 0,
  workerPayment: 0,
  adjustment: 0,
  received: 0,
  paid: 0,
  net: 0,
};

/** Build received / paid / net from raw category sums (amounts always positive for "out"). */
export function buildTotalsBreakdown(parts: {
  walletIn: number;
  walletOut: number;
  expense: number;
  workerPayment: number;
  adjustment: number;
}): TotalsBreakdown {
  const walletIn = parts.walletIn;
  const walletOut = parts.walletOut;
  const expense = parts.expense;
  const workerPayment = parts.workerPayment;
  const adjustment = parts.adjustment;

  const adjustmentIn = adjustment > 0 ? adjustment : 0;
  const adjustmentOut = adjustment < 0 ? Math.abs(adjustment) : 0;

  const received = walletIn + adjustmentIn;
  const paid = expense + workerPayment + walletOut + adjustmentOut;
  const net = received - paid;

  return {
    walletIn,
    walletOut,
    expense,
    workerPayment,
    adjustment,
    received,
    paid,
    net,
  };
}

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

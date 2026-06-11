import { addLocalDays, toLocalDateString } from "./dateFormat";

export type StockViewStatus = "in" | "low" | "out";

export type PublicStockActivity = {
  periodIn: number;
  periodOut: number;
  checkDiff: number;
  netChange: number;
  lastDiff: number | null;
  lastActivityAt: string | null;
};

export type PublicStockSale = {
  _id: string;
  stockId: string;
  name: string;
  brand: string;
  count: number;
  note: string;
  date: string;
  createdAt: string | null;
};

export type PublicStockReceipt = {
  _id: string;
  stockId: string;
  name: string;
  brand: string;
  count: number;
  note: string;
  date: string;
  createdAt: string | null;
};

export function getStockViewStatus(count: number, minStock: number): StockViewStatus {
  if (count <= 0) return "out";
  if (minStock > 0 && count <= minStock) return "low";
  return "in";
}

export function defaultPublicStockDateRange(): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    from: toLocalDateString(addLocalDays(today, -6)),
    to: toLocalDateString(today),
  };
}

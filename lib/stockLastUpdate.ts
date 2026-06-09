import type { StockItem } from "./stockTypes";

export const STOCK_UPDATE_HIGHLIGHT =
  "rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800";

export const STOCK_UPDATE_PANEL =
  "rounded-xl bg-amber-50 px-3 py-2 ring-2 ring-amber-300/80 dark:bg-amber-950/30 dark:ring-amber-700/60";

export function maxIsoDate(...dates: (string | null | undefined)[]): string | null {
  let best: number | null = null;
  let bestIso: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (!Number.isNaN(t) && (best === null || t > best)) {
      best = t;
      bestIso = d;
    }
  }
  return bestIso;
}

export function stockLastUserUpdate(
  item: Pick<StockItem, "lastCheckAt" | "updatedAt">
): string | null {
  return maxIsoDate(item.updatedAt, item.lastCheckAt);
}

export function itemsLastGodownCheck(
  items: Pick<StockItem, "lastCheckAt">[]
): string | null {
  return maxIsoDate(...items.map((i) => i.lastCheckAt));
}

export function itemsLastUserUpdate(
  items: Pick<StockItem, "lastCheckAt" | "updatedAt">[]
): string | null {
  return maxIsoDate(...items.map((i) => stockLastUserUpdate(i)));
}

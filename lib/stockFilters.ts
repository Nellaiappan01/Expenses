import type { StockFilter, StockItem, StockSort } from "./stockTypes";
import { scoreStockSearch } from "./stockSearch";

const STALE_DAYS = 30;

function compareBySort(a: StockItem, b: StockItem, sort: StockSort): number {
  if (sort === "count_desc") return b.count - a.count;
  if (sort === "value_desc") {
    return b.count * b.valuePerUnit - a.count * a.valuePerUnit;
  }
  if (sort === "last_check") {
    const ta = a.lastCheckAt ? new Date(a.lastCheckAt).getTime() : 0;
    const tb = b.lastCheckAt ? new Date(b.lastCheckAt).getTime() : 0;
    return tb - ta;
  }
  if (a.count === 0 && b.count !== 0) return 1;
  if (a.count !== 0 && b.count === 0) return -1;
  return a.name.localeCompare(b.name);
}

export function filterAndSortItems(
  list: StockItem[],
  query: string,
  filter: StockFilter,
  sort: StockSort
): StockItem[] {
  const q = query.trim();
  const now = Date.now();
  const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  let result = list;

  if (filter === "empty") {
    result = result.filter((i) => i.count === 0);
  } else if (filter === "in_stock") {
    result = result.filter((i) => i.count > 0);
  } else if (filter === "low") {
    result = result.filter((i) => {
      const min = i.minStock ?? 0;
      return min > 0 && i.count > 0 && i.count <= min;
    });
  } else if (filter === "stale") {
    result = result.filter((i) => {
      if (!i.lastCheckAt) return true;
      return now - new Date(i.lastCheckAt).getTime() > staleMs;
    });
  }

  if (q) {
    const scored = result
      .map((item) => ({ item, score: scoreStockSearch(item, q) }))
      .filter((x) => x.score > 0);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return compareBySort(a.item, b.item, sort);
    });

    return scored.map((x) => x.item);
  }

  result = [...result];
  result.sort((a, b) => compareBySort(a, b, sort));
  return result;
}

export function stockStats(items: StockItem[]) {
  const empty = items.filter((i) => i.count === 0).length;
  const low = items.filter((i) => {
    const min = i.minStock ?? 0;
    return min > 0 && i.count > 0 && i.count <= min;
  }).length;
  const withPhoto = items.filter((i) => i.hasPhoto).length;
  const totalCount = items.reduce((s, i) => s + i.count, 0);
  const totalValue = items.reduce((s, i) => s + i.count * i.valuePerUnit, 0);
  return { empty, low, withPhoto, totalCount, totalValue };
}

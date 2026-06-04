import type { StockFilter, StockItem, StockSort } from "./stockTypes";

const STALE_DAYS = 30;

export function filterAndSortItems(
  list: StockItem[],
  query: string,
  filter: StockFilter,
  sort: StockSort
): StockItem[] {
  const q = query.trim().toLowerCase();
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
    const tokens = q.split(/\s+/).filter(Boolean);
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

    result = result
      .map((item) => {
        const haystack = [
          item.name,
          item.sku,
          item.brand,
          item.size,
          item.category,
          item.location,
        ]
          .filter(Boolean)
          .join(" ");
        const name = normalize(haystack);
        const nameLower = haystack.toLowerCase();
        let score = 0;

        if (name === q) score = 100;
        else if (name.startsWith(q) || nameLower.startsWith(q)) score = 80;
        else if (name.includes(q) || nameLower.includes(q)) score = 60;
        else if (tokens.every((t) => name.includes(t) || nameLower.includes(t))) {
          const matchedTokens = tokens.filter((t) => name.includes(t) || nameLower.includes(t)).length;
          score = 40 + matchedTokens * 5;
        } else {
          const partialMatch = tokens.some((t) => name.includes(t) || nameLower.includes(t));
          if (partialMatch) score = 20;
          else return null;
        }
        return { item, score };
      })
      .filter((x): x is { item: StockItem; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  } else {
    result = [...result];
  }

  result.sort((a, b) => {
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
  });

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

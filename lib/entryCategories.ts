export const DEFAULT_WORKER_CATEGORIES = [
  "Salary",
  "Diesel",
  "Food",
  "Transport",
  "Maintenance",
  "Material",
  "Miscellaneous",
] as const;

export function mergeCategories(saved: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...DEFAULT_WORKER_CATEGORIES, ...(saved ?? [])]) {
    const t = c.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

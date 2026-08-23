export const DEFAULT_WORKER_CATEGORIES = [
  "Salary",
  "Diesel",
  "Food",
  "Transport",
  "Maintenance",
  "Material",
  "Miscellaneous",
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Raw Material",
  "Labour",
  "Transport",
  "Fuel",
  "Maintenance",
  "Utilities",
  "Office",
  "Miscellaneous",
] as const;

export const DEFAULT_EXPENSE_TAGS = [
  "Urgent",
  "Recurring",
  "Approved",
  "Pending Review",
] as const;

function mergeList(defaults: readonly string[], saved: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...defaults, ...(saved ?? [])]) {
    const t = c.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function mergeCategories(saved: string[] | undefined): string[] {
  return mergeList(DEFAULT_WORKER_CATEGORIES, saved);
}

export function mergeExpenseCategories(saved: string[] | undefined): string[] {
  return mergeList(DEFAULT_EXPENSE_CATEGORIES, saved);
}

export function mergeExpenseTags(saved: string[] | undefined): string[] {
  return mergeList(DEFAULT_EXPENSE_TAGS, saved);
}

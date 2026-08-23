export type ProfitabilityBucket = "transport" | "labour" | "diesel" | "other";

export type ProfitabilityCategoryRule =
  | "auto"
  | ProfitabilityBucket
  | "exclude";

export type ProfitabilityCategoryRules = Record<string, ProfitabilityCategoryRule>;

export type ProfitabilityBucketsConfig = {
  transport: string[];
  labour: string[];
  diesel: string[];
};

export const DEFAULT_PROFITABILITY_KEYWORDS: Record<
  Exclude<ProfitabilityBucket, "other">,
  string[]
> = {
  transport: ["transport", "freight", "lorry", "vehicle", "logistics", "carriage"],
  labour: ["labour", "labor", "wage", "wages", "salary", "worker", "loading"],
  diesel: ["diesel", "fuel", "petrol", "gas oil"],
};

export const PROFITABILITY_CATEGORY_RULE_LABELS: Record<ProfitabilityCategoryRule, string> = {
  auto: "Auto (keyword match)",
  transport: "Transport",
  labour: "Labour",
  diesel: "Diesel",
  other: "Other operating",
  exclude: "Exclude — Capital",
};

export type ProfitabilityCategoryRow = {
  category: string;
  amount: number;
  includedAmount: number;
  bucket: ProfitabilityBucket;
  excluded: boolean;
};

export type ProfitabilityExcludedRow = {
  category: string;
  amount: number;
  reason: "entry" | "category";
};

export type ProfitabilityRequesterRow = {
  name: string;
  amount: number;
  includedAmount: number;
  entryCount: number;
  excluded: boolean;
};

export type ProfitabilityExpenseBreakdown = {
  transport: number;
  labour: number;
  diesel: number;
  other: number;
  totalExpenses: number;
  entryCount: number;
  excludedCount: number;
  excludedAmount: number;
  byCategory: ProfitabilityCategoryRow[];
  allCategories: ProfitabilityCategoryRow[];
  allRequesters: ProfitabilityRequesterRow[];
  excluded: ProfitabilityExcludedRow[];
};

export function formatProfitCurrency(amount: number): string {
  return `₹${Math.abs(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
}

export function normalizeProfitCategory(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeProfitRequester(value: string): string {
  return value.trim().toLowerCase();
}

export function sanitizeProfitabilityExcludedRequesters(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const key = normalizeProfitRequester(String(item ?? ""));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function isRequesterExcluded(
  name: string,
  excludedRequesters: string[]
): boolean {
  const key = normalizeProfitRequester(name);
  return excludedRequesters.some((r) => normalizeProfitRequester(r) === key);
}

export function sanitizeProfitabilityCategoryRules(
  raw: unknown
): ProfitabilityCategoryRules {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set<ProfitabilityCategoryRule>([
    "auto",
    "transport",
    "labour",
    "diesel",
    "other",
    "exclude",
  ]);
  const out: ProfitabilityCategoryRules = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedKey = normalizeProfitCategory(key);
    if (!normalizedKey || typeof value !== "string") continue;
    if (!allowed.has(value as ProfitabilityCategoryRule)) continue;
    out[normalizedKey] = value as ProfitabilityCategoryRule;
  }
  return out;
}

export function resolveCategoryRule(
  category: string,
  categoryRules: ProfitabilityCategoryRules
): ProfitabilityCategoryRule {
  return categoryRules[normalizeProfitCategory(category || "other")] ?? "auto";
}

function matchesBucket(
  categoryLower: string,
  bucket: Exclude<ProfitabilityBucket, "other">,
  config: ProfitabilityBucketsConfig
): boolean {
  const explicit = config[bucket].map(normalizeProfitCategory);
  if (explicit.some((c) => c && categoryLower === c)) return true;

  const keywords = DEFAULT_PROFITABILITY_KEYWORDS[bucket];
  return keywords.some((kw) => categoryLower.includes(kw));
}

export function assignExpenseBucket(
  category: string,
  config: ProfitabilityBucketsConfig,
  categoryRules?: ProfitabilityCategoryRules
): ProfitabilityBucket | "exclude" {
  const rule = resolveCategoryRule(category, categoryRules ?? {});
  if (rule === "exclude") return "exclude";
  if (rule !== "auto") return rule;

  const key = normalizeProfitCategory(category || "other");
  if (matchesBucket(key, "transport", config)) return "transport";
  if (matchesBucket(key, "labour", config)) return "labour";
  if (matchesBucket(key, "diesel", config)) return "diesel";
  return "other";
}

export function buildProfitabilityBreakdown(
  entries: {
    category?: string;
    name?: string;
    amount: number;
    excludeFromProfitability?: boolean;
  }[],
  config?: Partial<ProfitabilityBucketsConfig>,
  categoryRules?: ProfitabilityCategoryRules,
  excludedRequesters?: string[]
): ProfitabilityExpenseBreakdown {
  const buckets: ProfitabilityBucketsConfig = {
    transport: config?.transport ?? [],
    labour: config?.labour ?? [],
    diesel: config?.diesel ?? [],
  };
  const rules = categoryRules ?? {};
  const excludedRequesterSet = new Set(
    (excludedRequesters ?? []).map(normalizeProfitRequester).filter(Boolean)
  );

  const totals = { transport: 0, labour: 0, diesel: 0, other: 0 };
  const categoryTotals = new Map<string, { amount: number; bucket: ProfitabilityBucket }>();
  const categoryIncludedTotals = new Map<string, number>();
  const categoryMap = new Map<string, { amount: number; bucket: ProfitabilityBucket }>();
  const requesterTotals = new Map<string, { amount: number; entryCount: number; name: string }>();
  const requesterIncludedTotals = new Map<string, number>();
  const excludedMap = new Map<string, { amount: number; reason: "entry" | "category" }>();
  let excludedCount = 0;
  let excludedAmount = 0;
  let includedCount = 0;

  for (const entry of entries) {
    const amount = Math.abs(Number(entry.amount) || 0);
    const category = entry.category?.trim() || "Other";
    const requester = entry.name?.trim() || "Unknown";
    const requesterKey = normalizeProfitRequester(requester);
    const bucketResult = assignExpenseBucket(category, buckets, rules);
    const displayBucket =
      bucketResult === "exclude"
        ? (assignExpenseBucket(category, buckets, {}) as ProfitabilityBucket)
        : bucketResult;

    const requesterRow = requesterTotals.get(requesterKey);
    if (requesterRow) {
      requesterRow.amount += amount;
      requesterRow.entryCount += 1;
    } else {
      requesterTotals.set(requesterKey, { amount, entryCount: 1, name: requester });
    }

    const catKey = normalizeProfitCategory(category);
    const catTotal = categoryTotals.get(catKey);
    if (catTotal) {
      catTotal.amount += amount;
    } else {
      categoryTotals.set(catKey, { amount, bucket: displayBucket });
    }

    const excludedByEntry = !!entry.excludeFromProfitability;
    const excludedByCategory = bucketResult === "exclude";
    const excludedByRequester = excludedRequesterSet.has(requesterKey);

    if (excludedByEntry || excludedByCategory || excludedByRequester) {
      excludedCount += 1;
      excludedAmount += amount;
      if (excludedByCategory || excludedByEntry) {
        const reason: "entry" | "category" = excludedByEntry ? "entry" : "category";
        const row = excludedMap.get(catKey);
        if (row) {
          row.amount += amount;
          if (row.reason === "category" && reason === "entry") row.reason = "entry";
        } else {
          excludedMap.set(catKey, { amount, reason });
        }
      }
      continue;
    }

    includedCount += 1;
    totals[bucketResult as ProfitabilityBucket] += amount;

    categoryIncludedTotals.set(
      catKey,
      (categoryIncludedTotals.get(catKey) ?? 0) + amount
    );
    requesterIncludedTotals.set(
      requesterKey,
      (requesterIncludedTotals.get(requesterKey) ?? 0) + amount
    );

    const row = categoryMap.get(catKey);
    if (row) {
      row.amount += amount;
    } else {
      categoryMap.set(catKey, { amount, bucket: bucketResult as ProfitabilityBucket });
    }
  }

  const byCategory = [...categoryMap.entries()]
    .map(([key, row]) => ({
      category:
        entries.find((e) => normalizeProfitCategory(e.category?.trim() || "Other") === key)
          ?.category?.trim() || key,
      amount: row.amount,
      includedAmount: row.amount,
      bucket: row.bucket,
      excluded: false,
    }))
    .sort((a, b) => b.amount - a.amount);

  const excluded = [...excludedMap.entries()]
    .map(([key, row]) => {
      const category =
        entries.find((e) => normalizeProfitCategory(e.category?.trim() || "Other") === key)
          ?.category?.trim() || key;
      const bucket = assignExpenseBucket(category, buckets, {}) as ProfitabilityBucket;
      return {
        category,
        amount: row.amount,
        reason: row.reason,
        bucket,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const allCategories = [...categoryTotals.entries()]
    .map(([key, row]) => {
      const category =
        entries.find((e) => normalizeProfitCategory(e.category?.trim() || "Other") === key)
          ?.category?.trim() || key;
      const excludedByCategory = resolveCategoryRule(category, rules) === "exclude";
      const includedAmount = excludedByCategory
        ? 0
        : (categoryIncludedTotals.get(key) ?? 0);
      return {
        category,
        amount: row.amount,
        includedAmount,
        bucket: row.bucket,
        excluded: excludedByCategory,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const allRequesters = [...requesterTotals.entries()]
    .map(([key, row]) => {
      const excludedByRequester = excludedRequesterSet.has(key);
      const includedAmount = excludedByRequester
        ? 0
        : (requesterIncludedTotals.get(key) ?? 0);
      return {
        name: row.name,
        amount: row.amount,
        includedAmount,
        entryCount: row.entryCount,
        excluded: excludedByRequester,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = totals.transport + totals.labour + totals.diesel + totals.other;

  return {
    ...totals,
    totalExpenses,
    entryCount: includedCount,
    excludedCount,
    excludedAmount,
    byCategory,
    allCategories,
    allRequesters,
    excluded,
  };
}

export function calculateProfitabilitySummary(input: {
  tonnage: number;
  ratePerTon: number;
  expenses: Pick<ProfitabilityExpenseBreakdown, "totalExpenses">;
}) {
  const grossRevenue = input.tonnage * input.ratePerTon;
  const netProfit = grossRevenue - input.expenses.totalExpenses;
  const profitPerTon = input.tonnage > 0 ? netProfit / input.tonnage : 0;

  return { grossRevenue, netProfit, profitPerTon };
}

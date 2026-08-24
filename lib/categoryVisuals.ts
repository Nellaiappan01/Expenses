export type CategoryIconKey =
  | "labour"
  | "water"
  | "lining"
  | "scrap"
  | "heap"
  | "kankani"
  | "tea"
  | "truck"
  | "fuel"
  | "driver"
  | "money"
  | "tag";

export type CategoryVisual = {
  icon: CategoryIconKey;
  shortLabel: string;
  chip: string;
  amount: string;
  tile: string;
};

const TONES: CategoryVisual[] = [
  { icon: "labour", shortLabel: "", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", amount: "text-emerald-700", tile: "from-emerald-50 to-white ring-emerald-100" },
  { icon: "water", shortLabel: "", chip: "bg-sky-50 text-sky-800 ring-sky-200", amount: "text-sky-700", tile: "from-sky-50 to-white ring-sky-100" },
  { icon: "lining", shortLabel: "", chip: "bg-amber-50 text-amber-900 ring-amber-200", amount: "text-amber-800", tile: "from-amber-50 to-white ring-amber-100" },
  { icon: "scrap", shortLabel: "", chip: "bg-rose-50 text-rose-800 ring-rose-200", amount: "text-rose-700", tile: "from-rose-50 to-white ring-rose-100" },
  { icon: "heap", shortLabel: "", chip: "bg-violet-50 text-violet-800 ring-violet-200", amount: "text-violet-700", tile: "from-violet-50 to-white ring-violet-100" },
  { icon: "truck", shortLabel: "", chip: "bg-teal-50 text-teal-800 ring-teal-200", amount: "text-teal-700", tile: "from-teal-50 to-white ring-teal-100" },
  { icon: "tea", shortLabel: "", chip: "bg-orange-50 text-orange-800 ring-orange-200", amount: "text-orange-700", tile: "from-orange-50 to-white ring-orange-100" },
  { icon: "fuel", shortLabel: "", chip: "bg-slate-100 text-slate-800 ring-slate-200", amount: "text-slate-700", tile: "from-slate-50 to-white ring-slate-200" },
];

function hashTone(name: string): CategoryVisual {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % TONES.length;
  return TONES[hash] ?? TONES[0];
}

export function categoryIconFor(name: string): CategoryIconKey {
  const n = name.trim().toLowerCase();
  if (!n) return "tag";
  if (n.includes("water") || n === "w.p" || n === "wp") return "water";
  if (n.includes("lining")) return "lining";
  if (n.includes("scrap")) return "scrap";
  if (n.includes("heap")) return "heap";
  if (n.includes("kankani")) return "kankani";
  if (n.includes("tea") || n.includes("coffee")) return "tea";
  if (n.includes("transport") || n.includes("truck") || n.includes("salt")) return "truck";
  if (n.includes("diesel") || n.includes("fuel") || n.includes("petrol")) return "fuel";
  if (n.includes("driver")) return "driver";
  if (n.includes("labour") || n.includes("labor") || n.includes("wage")) return "labour";
  if (n.includes("cash") || n.includes("bank") || n.includes("gpay")) return "money";
  return "tag";
}

export function shortCategoryLabel(name: string): string {
  const n = name.trim();
  if (/water\s*pass/i.test(n)) return "W.P";
  if (n.length <= 12) return n;
  return n.slice(0, 11) + "…";
}

export function getCategoryVisual(name: string): CategoryVisual {
  const icon = categoryIconFor(name);
  const tone = hashTone(name.toLowerCase());
  const byIcon: Partial<Record<CategoryIconKey, CategoryVisual>> = {
    labour: TONES[0],
    water: TONES[1],
    lining: TONES[2],
    scrap: TONES[3],
    heap: TONES[4],
    truck: TONES[5],
    tea: TONES[6],
    kankani: TONES[4],
    fuel: TONES[7],
    driver: TONES[5],
    money: TONES[0],
    tag: tone,
  };
  const visual = byIcon[icon] ?? tone;
  return { ...visual, icon, shortLabel: shortCategoryLabel(name) };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { addLocalDays, formatDayMonthYear, formatTimeHHMM, toLocalDateString } from "@/lib/dateFormat";
import { matchesStockSearch, scoreStockSearch } from "@/lib/stockSearch";
import {
  defaultPublicStockDateRange,
  type PublicStockActivity,
  type PublicStockReceipt,
  type PublicStockSale,
  type StockViewStatus,
} from "@/lib/publicStockTypes";
import { getPatternImageUrl } from "@/lib/patternImageUrl";
import { BrandBadge } from "./BrandBadge";
import { PublicStockUserProvider, usePublicStockUser } from "./PublicStockUserContext";
import { SalesPatternPicker, type SalesPatternOption } from "./SalesPatternPicker";
import { PatternDetailSheet } from "./PatternDetailSheet";
import { TyreLogoIcon } from "./ShopLogo";
import type { ViewStockItem } from "./PatternDetailSheet";
import { PatternTable } from "./PatternTable";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";

type StockItem = {
  _id: string;
  name: string;
  count: number;
  valuePerUnit: number;
  minStock: number;
  brand: string;
  size: string;
  category: string;
  subtitle: string;
  status: StockViewStatus;
  lastCheckAt: string | null;
  updatedAt?: string | null;
  activity?: PublicStockActivity;
  hasPhoto?: boolean;
  photoUrl?: string;
  photoThumbUrl?: string;
};

const LONG_PRESS_MS = 480;

function formatRupee(amount: number): string {
  return amount.toLocaleString("en-IN", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

function sellingPrice(valuePerUnit: number): number {
  return valuePerUnit * 2;
}

type Payload = {
  shopTitle: string;
  subtitle: string;
  updatedAt: string;
  lastUserUpdateAt?: string | null;
  items: StockItem[];
  sales?: PublicStockSale[];
  receipts?: PublicStockReceipt[];
  salesSummary?: { totalPcs: number; count: number };
  receiptsSummary?: { totalPcs: number; count: number };
  dateRange?: { from: string; to: string };
};

const STATUS_META: Record<
  StockViewStatus,
  {
    label: string;
    badge: string;
    count: string;
    qtyDot: string;
    icon: "check" | "warn" | "x";
  }
> = {
  in: {
    label: "In stock",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    count: "text-emerald-600",
    qtyDot: "bg-emerald-400",
    icon: "check",
  },
  low: {
    label: "Low stock",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    count: "text-amber-600",
    qtyDot: "bg-amber-400",
    icon: "warn",
  },
  out: {
    label: "Out of stock",
    badge: "bg-red-50 text-red-700 ring-red-200",
    count: "text-red-500",
    qtyDot: "bg-red-400",
    icon: "x",
  },
};

type StatKey = "all" | "in" | "out" | "pcs" | "sales";

const STAT_FILTER: Record<StatKey, "" | StockViewStatus> = {
  all: "",
  in: "in",
  out: "out",
  pcs: "",
  sales: "",
};

const RECEIPT_DATE_THEMES = [
  {
    section:
      "rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-400/20 via-white/40 to-emerald-50/25 p-2 shadow-[0_8px_24px_rgba(16,185,129,0.12)] backdrop-blur-md",
    header:
      "rounded-xl border border-white/70 bg-white/55 px-3 py-2 shadow-sm backdrop-blur-sm",
    dot: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]",
    title: "text-emerald-950",
    badge: "bg-emerald-500/25 text-emerald-900 ring-1 ring-emerald-300/60 backdrop-blur-sm",
    row: "rounded-xl border border-white/70 bg-white/50 px-3 py-3 shadow-sm backdrop-blur-sm transition hover:bg-white/75 hover:shadow-md active:scale-[0.99]",
    qty: "rounded-lg bg-emerald-500/20 px-2.5 py-1 text-sm font-bold text-emerald-900 ring-1 ring-emerald-400/35 backdrop-blur-sm",
    time: "text-emerald-800/60",
    note: "text-emerald-900/85",
    noteLabel: "text-emerald-700",
  },
  {
    section:
      "rounded-2xl border border-teal-200/50 bg-gradient-to-br from-teal-400/20 via-white/40 to-cyan-50/25 p-2 shadow-[0_8px_24px_rgba(20,184,166,0.12)] backdrop-blur-md",
    header:
      "rounded-xl border border-white/70 bg-white/55 px-3 py-2 shadow-sm backdrop-blur-sm",
    dot: "bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.55)]",
    title: "text-teal-950",
    badge: "bg-teal-500/25 text-teal-900 ring-1 ring-teal-300/60 backdrop-blur-sm",
    row: "rounded-xl border border-white/70 bg-white/50 px-3 py-3 shadow-sm backdrop-blur-sm transition hover:bg-white/75 hover:shadow-md active:scale-[0.99]",
    qty: "rounded-lg bg-teal-500/20 px-2.5 py-1 text-sm font-bold text-teal-900 ring-1 ring-teal-400/35 backdrop-blur-sm",
    time: "text-teal-800/60",
    note: "text-teal-900/85",
    noteLabel: "text-teal-700",
  },
  {
    section:
      "rounded-2xl border border-cyan-200/50 bg-gradient-to-br from-cyan-400/20 via-white/40 to-sky-50/25 p-2 shadow-[0_8px_24px_rgba(6,182,212,0.12)] backdrop-blur-md",
    header:
      "rounded-xl border border-white/70 bg-white/55 px-3 py-2 shadow-sm backdrop-blur-sm",
    dot: "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.55)]",
    title: "text-cyan-950",
    badge: "bg-cyan-500/25 text-cyan-900 ring-1 ring-cyan-300/60 backdrop-blur-sm",
    row: "rounded-xl border border-white/70 bg-white/50 px-3 py-3 shadow-sm backdrop-blur-sm transition hover:bg-white/75 hover:shadow-md active:scale-[0.99]",
    qty: "rounded-lg bg-cyan-500/20 px-2.5 py-1 text-sm font-bold text-cyan-900 ring-1 ring-cyan-400/35 backdrop-blur-sm",
    time: "text-cyan-800/60",
    note: "text-cyan-900/85",
    noteLabel: "text-cyan-700",
  },
  {
    section:
      "rounded-2xl border border-sky-200/50 bg-gradient-to-br from-sky-400/20 via-white/40 to-blue-50/25 p-2 shadow-[0_8px_24px_rgba(14,165,233,0.12)] backdrop-blur-md",
    header:
      "rounded-xl border border-white/70 bg-white/55 px-3 py-2 shadow-sm backdrop-blur-sm",
    dot: "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.55)]",
    title: "text-sky-950",
    badge: "bg-sky-500/25 text-sky-900 ring-1 ring-sky-300/60 backdrop-blur-sm",
    row: "rounded-xl border border-white/70 bg-white/50 px-3 py-3 shadow-sm backdrop-blur-sm transition hover:bg-white/75 hover:shadow-md active:scale-[0.99]",
    qty: "rounded-lg bg-sky-500/20 px-2.5 py-1 text-sm font-bold text-sky-900 ring-1 ring-sky-400/35 backdrop-blur-sm",
    time: "text-sky-800/60",
    note: "text-sky-900/85",
    noteLabel: "text-sky-700",
  },
] as const;

function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusIcon({ kind }: { kind: "check" | "warn" | "x" }) {
  if (kind === "check") {
    return (
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (kind === "warn") {
    return (
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
      </svg>
    );
  }
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PatternImage({ item, dimmed }: { item: StockItem; dimmed?: boolean }) {
  const [failed, setFailed] = useState(false);
  const publicUser = usePublicStockUser();
  const src = getPatternImageUrl(item, publicUser);

  if (!src || failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${dimmed ? "grayscale" : ""}`}
      >
        <svg className="h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
          <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeWidth={1.5} d="M12 3v18M3 12h18" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] ${dimmed ? "grayscale opacity-60" : ""}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-[18px] w-[18px] ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function DoNotDisturbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0112 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0112 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" />
    </svg>
  );
}

function LastStockUpdateSheet({
  open,
  lastUserUpdateAt,
  refreshing,
  onClose,
  onRefresh,
}: {
  open: boolean;
  lastUserUpdateAt?: string | null;
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="nav-sheet-backdrop fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="nav-sheet fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-200" />
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <DoNotDisturbIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Last stock update
              </p>
              {lastUserUpdateAt ? (
                <>
                  <p className="mt-1 text-base font-bold text-amber-950">
                    {formatDayMonthYear(lastUserUpdateAt)} ·{" "}
                    {formatClock(new Date(lastUserUpdateAt))}
                  </p>
                  <p className="mt-1 text-sm font-medium text-amber-700">
                    Not live — updated when shop changes stock
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold text-amber-900">No shop update recorded yet</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <RefreshIcon spinning={refreshing} />
            {refreshing ? "Refreshing…" : "Refresh page"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

function StockSubtitle({ text }: { text: string }) {
  const normalized = text.trim();
  const match = normalized.match(/^(Real-time)\s+(stock status)\.?$/i);
  if (match) {
    return (
      <p className="mt-1 max-w-md text-sm font-semibold leading-snug">
        <span className="text-emerald-600">{match[1]}</span>{" "}
        <span className="text-amber-500">{match[2]}</span>
      </p>
    );
  }
  return <p className="mt-1 max-w-md text-sm text-slate-600">{text}</p>;
}

function StatCard({
  label,
  value,
  barColor,
  iconBg,
  iconColor,
  icon,
  delay,
  active,
  onClick,
  compact,
  hint,
  subLabel,
}: {
  label: string;
  value: string | number;
  barColor: string;
  iconBg: string;
  iconColor: string;
  icon: ReactNode;
  delay: string;
  active?: boolean;
  onClick: () => void;
  /** Full-width slim bar on mobile (2-col grid) */
  compact?: boolean;
  hint?: string;
  subLabel?: string;
}) {
  const shell = `stock-view-stat relative w-full overflow-hidden rounded-2xl bg-white text-left shadow-[0_2px_12px_rgba(15,23,42,0.06)] ring-1 transition-[box-shadow,background-color,ring-color] duration-200 ease-out ${
    active
      ? "bg-slate-50/80 ring-2 ring-slate-800 shadow-[0_4px_20px_rgba(15,23,42,0.1)]"
      : "ring-slate-100 hover:bg-slate-50/40 hover:ring-slate-200"
  }`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${shell} col-span-2 p-3 sm:col-span-1 sm:p-4`}
        style={{ animationDelay: delay }}
        aria-pressed={active}
      >
        <div className={`absolute inset-x-0 top-0 h-1 ${barColor} ${active ? "opacity-100" : "opacity-70"}`} />
        <div className="flex items-center gap-3 sm:hidden">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            {subLabel && (
              <p className="text-[10px] font-semibold text-violet-600">{subLabel}</p>
            )}
            <p className="text-xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</p>
          </div>
          {hint && <p className="shrink-0 text-[11px] font-semibold text-slate-400">{hint}</p>}
        </div>
        <div className="hidden items-center justify-between gap-2 sm:flex">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            {subLabel && (
              <p className="text-[10px] font-semibold text-violet-600">{subLabel}</p>
            )}
            <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {value}
            </p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconBg} ${iconColor}`}>
            {icon}
          </div>
        </div>
        <p className="mt-2 hidden min-h-[14px] text-[10px] font-semibold text-slate-400 sm:block">
          {active ? "Tap to collapse" : "\u00A0"}
        </p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shell} p-4`}
      style={{ animationDelay: delay }}
      aria-pressed={active}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${barColor} ${active ? "opacity-100" : "opacity-70"}`} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          {subLabel && (
            <p className="text-[10px] font-semibold text-violet-600">{subLabel}</p>
          )}
          <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 min-h-[14px] text-[10px] font-semibold text-slate-400">
        {active ? "Tap to collapse" : "\u00A0"}
      </p>
    </button>
  );
}

function formatSalesPeriodLabel(range?: { from: string; to: string }): string {
  const defaults = defaultPublicStockDateRange();
  const from = range?.from ?? defaults.from;
  const to = range?.to ?? defaults.to;
  if (from === to) return formatDayMonthYear(from);
  return `${formatDayMonthYear(from)} – ${formatDayMonthYear(to)}`;
}

function DiffBadge({ net }: { net: number }) {
  if (net === 0) {
    return (
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-500">
        —
      </span>
    );
  }
  const positive = net > 0;
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ${
        positive
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-red-50 text-red-600 ring-red-200"
      }`}
    >
      {positive ? "+" : ""}
      {net}
    </span>
  );
}

type DayMovementRow = {
  stockId: string;
  name: string;
  date: string;
  count: number;
  status: StockViewStatus;
  periodIn: number;
  periodOut: number;
};

function buildDayMovementsByDate(
  receipts: PublicStockReceipt[],
  sales: PublicStockSale[],
  items: StockItem[],
  statKey: "all" | "out" | "pcs",
  search: string
): { groups: [string, DayMovementRow[]][]; unchanged: StockItem[] } {
  const itemMap = new Map(items.map((i) => [i._id, i]));
  const cells = new Map<string, DayMovementRow>();

  function touch(date: string, stockId: string, kind: "in" | "out", count: number) {
    const key = `${date}|${stockId}`;
    let row = cells.get(key);
    if (!row) {
      const item = itemMap.get(stockId);
      row = {
        stockId,
        name: item?.name ?? stockId,
        date,
        count: item?.count ?? 0,
        status: item?.status ?? "out",
        periodIn: 0,
        periodOut: 0,
      };
      cells.set(key, row);
    }
    if (kind === "in") row.periodIn += count;
    else row.periodOut += count;
  }

  for (const r of receipts) touch(r.date, r.stockId, "in", r.count);
  for (const s of sales) touch(s.date, s.stockId, "out", s.count);

  const q = search.trim();
  let rows = [...cells.values()].filter((r) => r.periodIn > 0 || r.periodOut > 0);

  if (statKey === "out") {
    rows = rows.filter((r) => itemMap.get(r.stockId)?.status === "out");
  }

  if (q) {
    rows = rows.filter((r) => {
      const item = itemMap.get(r.stockId);
      return item ? matchesStockSearch(item, q) : r.name.toLowerCase().includes(q.toLowerCase());
    });
  }

  const groups = new Map<string, DayMovementRow[]>();
  for (const row of rows) {
    const bucket = groups.get(row.date) ?? [];
    bucket.push(row);
    groups.set(row.date, bucket);
  }

  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  for (const [, bucket] of sorted) {
    if (statKey === "pcs") {
      bucket.sort((a, b) => b.count - a.count);
    } else {
      bucket.sort(
        (a, b) =>
          Math.abs(b.periodIn - b.periodOut) - Math.abs(a.periodIn - a.periodOut)
      );
    }
  }

  const movedIds = new Set(rows.map((r) => r.stockId));
  let unchanged = items.filter((i) => !movedIds.has(i._id));
  if (statKey === "out") unchanged = unchanged.filter((i) => i.status === "out");
  if (q) {
    unchanged = unchanged
      .filter((i) => matchesStockSearch(i, q))
      .sort((a, b) => scoreStockSearch(b, q) - scoreStockSearch(a, q));
  } else if (statKey === "pcs") {
    unchanged = [...unchanged].sort((a, b) => b.count - a.count);
  } else {
    unchanged = [...unchanged].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { groups: sorted, unchanged };
}

function StatDetailPanel({
  statKey,
  items,
  stats,
  sales,
  receipts,
  search,
  dateFrom,
  dateTo,
  activityLoading,
  onDateFromChange,
  onDateToChange,
  onPreset,
  onSelect,
  onSelectSale,
  onSelectReceipt,
  onClose,
}: {
  statKey: StatKey;
  items: StockItem[];
  stats: {
    total: number;
    inStock: number;
    out: number;
    totalPcs: number;
    salesPcs: number;
    salesCount: number;
    receiptsPcs: number;
    receiptsCount: number;
  };
  sales: PublicStockSale[];
  receipts: PublicStockReceipt[];
  search: string;
  dateFrom: string;
  dateTo: string;
  activityLoading: boolean;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onPreset: (days: number) => void;
  onSelect: (item: StockItem) => void;
  onSelectSale: (sale: PublicStockSale) => void;
  onSelectReceipt: (receipt: PublicStockReceipt) => void;
  onClose: () => void;
}) {
  const [salesPatternFilter, setSalesPatternFilter] = useState("");

  useEffect(() => {
    if (statKey !== "sales") setSalesPatternFilter("");
  }, [statKey]);

  const panelHeader = (title: string, hint: string) => (
    <div className="stock-view-stat-fold-inner mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Close
      </button>
    </div>
  );
  const receiptsByDate = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = receipts;
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.note.toLowerCase().includes(q) ||
          r.brand.toLowerCase().includes(q)
      );
    }
    const groups = new Map<string, PublicStockReceipt[]>();
    for (const r of list) {
      const bucket = groups.get(r.date) ?? [];
      bucket.push(r);
      groups.set(r.date, bucket);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [receipts, search]);

  const salesPatternOptions = useMemo((): SalesPatternOption[] => {
    const map = new Map<string, SalesPatternOption>();
    for (const s of sales) {
      const existing = map.get(s.stockId);
      if (existing) {
        existing.pcs += s.count;
        existing.count += 1;
      } else {
        map.set(s.stockId, {
          id: s.stockId,
          name: s.name,
          brand: s.brand,
          pcs: s.count,
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [sales]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = sales;
    if (salesPatternFilter) {
      list = list.filter((s) => s.stockId === salesPatternFilter);
    }
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.note.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sales, salesPatternFilter, search]);

  const filteredSalesSummary = useMemo(
    () => ({
      pcs: filteredSales.reduce((sum, s) => sum + s.count, 0),
      count: filteredSales.length,
    }),
    [filteredSales]
  );

  const salesByDate = useMemo(() => {
    const groups = new Map<string, PublicStockSale[]>();
    for (const s of filteredSales) {
      const bucket = groups.get(s.date) ?? [];
      bucket.push(s);
      groups.set(s.date, bucket);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSales]);

  const selectedSalesPatternName =
    salesPatternOptions.find((p) => p.id === salesPatternFilter)?.name ?? "";

  const dateFilterBar = (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="flex min-w-[120px] flex-1 flex-col gap-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From</label>
        <input
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-stone-300"
        />
      </div>
      <div className="flex min-w-[120px] flex-1 flex-col gap-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To</label>
        <input
          type="date"
          value={dateTo}
          min={dateFrom}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-stone-300"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Today", days: 1 },
          { label: "7 days", days: 7 },
          { label: "30 days", days: 30 },
        ].map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => onPreset(p.days)}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-stone-800 hover:text-white hover:ring-stone-800"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );

  const salesFilterBar = (
    <div className="mb-4 space-y-3">
      {dateFilterBar}
      <div className="rounded-2xl bg-violet-50/60 p-3 ring-1 ring-violet-100">
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-violet-700/80">
          Pattern
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <SalesPatternPicker
            options={salesPatternOptions}
            value={salesPatternFilter}
            onChange={setSalesPatternFilter}
          />
          {salesPatternFilter ? (
            <div className="flex shrink-0 flex-row items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-violet-200 sm:min-w-[148px] sm:flex-col sm:items-start sm:justify-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700/80">
                Selected total
              </p>
              <div className="text-right sm:text-left">
                <p className="text-sm font-extrabold tabular-nums text-violet-900">
                  {filteredSalesSummary.pcs.toLocaleString("en-IN")} PCS
                </p>
                <p className="text-[10px] font-medium text-violet-700/90">
                  {filteredSalesSummary.count}{" "}
                  {filteredSalesSummary.count === 1 ? "sale" : "sales"} in period
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const { groups: dayMovementGroups, unchanged } = useMemo(() => {
    if (statKey === "sales" || statKey === "in") {
      return { groups: [] as [string, DayMovementRow[]][], unchanged: [] as StockItem[] };
    }
    return buildDayMovementsByDate(receipts, sales, items, statKey, search);
  }, [receipts, sales, items, statKey, search]);

  const titles: Record<Exclude<StatKey, "sales">, string> = {
    all: `All patterns · ${stats.total}`,
    in: `Available in godown · ${stats.inStock}`,
    out: `Out of stock · ${stats.out}`,
    pcs: `Stock by quantity · ${stats.totalPcs.toLocaleString("en-IN")} PCS`,
  };

  const hints: Record<Exclude<StatKey, "sales">, string> = {
    all: `${stats.totalPcs.toLocaleString("en-IN")} pieces · stock in / out per day`,
    in: `${stats.inStock} patterns in godown now`,
    out: "Zero in godown · stock out in period",
    pcs: "Sorted by quantity · stock in / out shown",
  };

  function renderMovementRow(row: DayMovementRow, highlight?: boolean) {
    const flowNet = row.periodIn - row.periodOut;

    return (
      <li key={`${row.date}|${row.stockId}`}>
        <button
          type="button"
          onClick={() => {
            const item = items.find((i) => i._id === row.stockId);
            if (item) onSelect(item);
          }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150 active:bg-slate-100 ${
            highlight
              ? "bg-emerald-50/60 ring-1 ring-emerald-100 hover:bg-emerald-50"
              : "hover:bg-slate-50"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">
              {row.periodIn > 0 && <span className="text-emerald-600">+{row.periodIn} stock in</span>}
              {row.periodIn > 0 && row.periodOut > 0 && " · "}
              {row.periodOut > 0 && <span className="text-red-500">−{row.periodOut} stock out</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`text-sm font-bold tabular-nums ${
                row.status === "out"
                  ? "text-red-500"
                  : row.status === "low"
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            >
              {row.count} pcs
            </span>
            <DiffBadge net={flowNet} />
          </div>
        </button>
      </li>
    );
  }

  function renderStaticRow(item: StockItem) {
    return (
      <li key={item._id}>
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
        >
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{item.name}</p>
          <span
            className={`text-sm font-bold tabular-nums ${
              item.status === "out"
                ? "text-red-500"
                : item.status === "low"
                  ? "text-amber-600"
                  : "text-emerald-600"
            }`}
          >
            {item.count} pcs
          </span>
        </button>
      </li>
    );
  }

  if (statKey === "in") {
    const glassFilterBar = (
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/70 bg-white/45 p-3 shadow-[0_4px_20px_rgba(16,185,129,0.08)] ring-1 ring-emerald-100/50 backdrop-blur-md">
        <div className="flex min-w-[120px] flex-1 flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70">From</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="rounded-xl border-0 bg-white/70 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-white/80 backdrop-blur-sm focus:ring-2 focus:ring-emerald-300/60"
          />
        </div>
        <div className="flex min-w-[120px] flex-1 flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70">To</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => onDateToChange(e.target.value)}
            className="rounded-xl border-0 bg-white/70 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-white/80 backdrop-blur-sm focus:ring-2 focus:ring-emerald-300/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Today", days: 1 },
            { label: "7 days", days: 7 },
            { label: "30 days", days: 30 },
          ].map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => onPreset(p.days)}
              className="rounded-full border border-white/80 bg-white/55 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-emerald-600 hover:text-white hover:ring-emerald-600"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    );

    return (
      <div className="stock-view-stat-fold mx-1 rounded-3xl border border-white/80 bg-gradient-to-br from-emerald-50/70 via-white/50 to-teal-50/60 px-4 pb-5 pt-4 shadow-[0_12px_40px_rgba(16,185,129,0.1)] backdrop-blur-xl sm:mx-0 sm:px-5">
        <div className="stock-view-stat-fold-inner">
          {panelHeader(
            `New stock in · ${stats.receiptsPcs.toLocaleString("en-IN")} PCS (${stats.receiptsCount} entries)`,
            hints.in
          )}
        </div>
        {glassFilterBar}
        {activityLoading && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3 py-2 text-xs font-medium text-emerald-800/80 backdrop-blur-sm">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
            Loading stock in…
          </div>
        )}
        {receiptsByDate.length === 0 ? (
          <p className="rounded-2xl border border-white/60 bg-white/45 py-12 text-center text-sm text-slate-600 backdrop-blur-sm">
            No new stock in this period
          </p>
        ) : (
          <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto overscroll-contain pr-1 scroll-smooth">
            {receiptsByDate.map(([dateKey, group], themeIndex) => {
              const theme = RECEIPT_DATE_THEMES[themeIndex % RECEIPT_DATE_THEMES.length];
              const dayPcs = group.reduce((s, r) => s + r.count, 0);
              return (
                <section key={dateKey} className={theme.section}>
                  <div className={`sticky top-0 z-10 mb-2 flex items-center gap-2 ${theme.header}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.title}`}>
                      {formatDayMonthYear(`${dateKey}T12:00:00`)}
                    </h4>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${theme.badge}`}
                    >
                      +{dayPcs} PCS · {group.length} entries
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {group.map((receipt) => (
                      <li key={receipt._id}>
                        <button
                          type="button"
                          onClick={() => onSelectReceipt(receipt)}
                          className={`flex w-full items-center gap-3 text-left ${theme.row}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {receipt.name}
                            </p>
                            {receipt.note ? (
                              <p className={`mt-1 text-xs font-medium ${theme.note}`}>
                                <span className={`font-bold ${theme.noteLabel}`}>Note:</span>{" "}
                                {receipt.note}
                              </p>
                            ) : null}
                            {receipt.createdAt && (
                              <p className={`mt-0.5 text-[10px] font-medium ${theme.time}`}>
                                {formatTimeHHMM(receipt.createdAt)}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 tabular-nums ${theme.qty}`}
                          >
                            +{receipt.count} pcs
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (statKey === "sales") {
    const salesTitle = salesPatternFilter
      ? `Sales · ${filteredSalesSummary.pcs.toLocaleString("en-IN")} PCS (${filteredSalesSummary.count} entries) · ${selectedSalesPatternName}`
      : `Sales · ${stats.salesPcs.toLocaleString("en-IN")} PCS (${stats.salesCount} entries)`;

    return (
      <div className="stock-view-stat-fold px-4 pb-5 pt-4 sm:px-5">
        {panelHeader(salesTitle, "Stock out / sold — filter by pattern & date")}
        {salesFilterBar}
        {activityLoading && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-stone-600" />
            Loading sales…
          </div>
        )}
        {salesByDate.length === 0 ? (
          <p className="rounded-xl bg-slate-50 py-12 text-center text-sm text-slate-500">
            {salesPatternFilter
              ? "No sales for this pattern in this period"
              : "No stock out in this period"}
          </p>
        ) : (
          <div className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto overscroll-contain pr-1 scroll-smooth">
            {salesByDate.map(([dateKey, group]) => {
              const dayPcs = group.reduce((s, r) => s + r.count, 0);
              return (
                <section key={dateKey}>
                  <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-white/95 py-1 backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {formatDayMonthYear(`${dateKey}T12:00:00`)}
                    </h4>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                      {dayPcs} pcs · {group.length} sale{group.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {group.map((sale) => (
                      <li key={sale._id}>
                        <button
                          type="button"
                          onClick={() => onSelectSale(sale)}
                          className="flex w-full items-start gap-3 rounded-xl bg-violet-50/40 px-3 py-3 text-left ring-1 ring-violet-100 transition-colors hover:bg-violet-50 active:bg-violet-100/80"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{sale.name}</p>
                            {sale.note ? (
                              <p className="mt-1 text-xs font-medium text-amber-800/90">
                                <span className="font-bold text-amber-600">Note:</span> {sale.note}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs italic text-slate-400">No note</p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-sm font-bold tabular-nums text-red-600 ring-1 ring-red-100">
                            −{sale.count} pcs
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stock-view-stat-fold px-4 pb-5 pt-4 sm:px-5">
      {panelHeader(titles[statKey], hints[statKey])}

      {dateFilterBar}

      {activityLoading && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-stone-600" />
          Updating period changes…
        </div>
      )}
      {dayMovementGroups.length === 0 && unchanged.length === 0 ? (
        <p className="rounded-xl bg-slate-50 py-12 text-center text-sm text-slate-500">No items in this group</p>
      ) : (
        <div className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto overscroll-contain pr-1 scroll-smooth">
          {dayMovementGroups.map(([dateKey, group]) => (
            <section key={dateKey}>
              <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-white/95 py-1 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {formatDayMonthYear(`${dateKey}T12:00:00`)}
                </h4>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {group.length} with stock in/out
                </span>
              </div>
              <ul className="space-y-1">{group.map((row) => renderMovementRow(row, true))}</ul>
            </section>
          ))}

          {unchanged.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  No stock in or out in period · {unchanged.length}
                </h4>
              </div>
              <ul className="space-y-1">{unchanged.map(renderStaticRow)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function PatternCard({
  item,
  index,
  onSelect,
}: {
  item: StockItem;
  index: number;
  onSelect: (item: StockItem) => void;
}) {
  const meta = STATUS_META[item.status];
  const isOut = item.status === "out";
  const [priceOpen, setPriceOpen] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const hidePriceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPrice = item.valuePerUnit > 0;
  const sellPrice = hasPrice ? sellingPrice(item.valuePerUnit) : 0;

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function scheduleHidePrice() {
    if (hidePriceRef.current) clearTimeout(hidePriceRef.current);
    hidePriceRef.current = setTimeout(() => setPriceOpen(false), 2200);
  }

  function handleClick() {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    onSelect(item);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseLeave={() => setPriceOpen(false)}
      onTouchStart={() => {
        if (!hasPrice) return;
        longPressFiredRef.current = false;
        clearLongPress();
        longPressRef.current = setTimeout(() => {
          longPressFiredRef.current = true;
          setPriceOpen(true);
        }, LONG_PRESS_MS);
      }}
      onTouchEnd={() => {
        clearLongPress();
        if (longPressFiredRef.current) scheduleHidePrice();
      }}
      onTouchCancel={() => {
        clearLongPress();
        if (longPressFiredRef.current) scheduleHidePrice();
      }}
      className={`stock-view-card group relative flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-[0_2px_16px_rgba(15,23,42,0.07)] ring-1 transition-all duration-300 active:scale-[0.99] md:hover:-translate-y-1 md:hover:scale-[1.04] md:hover:shadow-[0_14px_36px_rgba(15,23,42,0.14)] ${
        isOut ? "ring-red-100/80" : "ring-slate-100"
      } ${priceOpen ? "stock-view-card-price-open" : ""}`}
      style={{ animationDelay: `${Math.min(index * 0.035, 0.55)}s` }}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-slate-100">
        <PatternImage item={item} dimmed={isOut} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

        {item.brand && (
          <BrandBadge
            brand={item.brand}
            className="absolute right-0 top-0 z-10 max-w-[75%] rounded-tl-none rounded-tr-none rounded-bl-xl shadow-md"
          />
        )}

        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 px-2 pb-2 pt-8">
          <div
            className={`flex items-center gap-2 rounded-lg bg-black/45 px-2 py-1.5 backdrop-blur-md ring-1 ring-white/15 ${isOut ? "opacity-80" : ""}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.qtyDot} ring-2 ring-white/30`} />
            <span className="text-base font-black leading-none tabular-nums text-white">
              {item.count}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">pcs</span>
          </div>
        </div>

        {hasPrice && (
          <div
            className={`stock-view-price-overlay pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-all duration-250 md:group-hover:opacity-100 ${
              priceOpen ? "opacity-100" : ""
            }`}
          >
            <div className="stock-view-price-pop rounded-2xl bg-white px-4 py-3 text-center shadow-2xl ring-1 ring-white/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selling price</p>
              <p className="mt-0.5 text-xl font-black tabular-nums text-slate-900">
                ₹{formatRupee(sellPrice)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                ₹{formatRupee(item.valuePerUnit)} × 2
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900">{item.name}</h3>
        {item.subtitle && !item.brand && (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.subtitle}</p>
        )}
        {item.status !== "in" && (
          <div
            className={`mt-2 inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.badge}`}
          >
            <StatusIcon kind={meta.icon} />
            {meta.label}
          </div>
        )}
      </div>
    </button>
  );
}

export function PublicStockView({ publicUser }: { publicUser?: string } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [syncFlash, setSyncFlash] = useState(false);
  const [updateInfoOpen, setUpdateInfoOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [status, setStatus] = useState<"" | StockViewStatus>("");
  const [selectedItem, setSelectedItem] = useState<ViewStockItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [expandedStat, setExpandedStat] = useState<StatKey | null>(null);
  const defaultRange = defaultPublicStockDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("stock-view-layout");
      if (saved === "card" || saved === "table") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem("stock-view-layout", mode);
    } catch {
      // ignore
    }
  }

  const load = useCallback(
    async (opts?: {
      silent?: boolean;
      panel?: boolean;
      from?: string;
      to?: string;
      details?: boolean;
    }) => {
      const silent = opts?.silent ?? false;
      const panel = opts?.panel ?? false;
      if (!silent) setLoading(true);
      else if (panel) setActivityLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const params = new URLSearchParams();
        const range = defaultPublicStockDateRange();
        params.set("from", opts?.from ?? range.from);
        params.set("to", opts?.to ?? range.to);
        if (opts?.details) params.set("details", "1");
        if (publicUser) params.set("user", publicUser);
        const res = await fetch(`/api/public/stock?${params}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setData(json);
        if (!panel) {
          setSyncFlash(true);
          setTimeout(() => setSyncFlash(false), 800);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setActivityLoading(false);
      }
    },
    [publicUser]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!expandedStat) return;
    load({
      silent: true,
      panel: true,
      from: dateFrom,
      to: dateTo,
      details: true,
    });
  }, [expandedStat, dateFrom, dateTo, load]);

  const items = data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim();
    const statusOrder: Record<StockViewStatus, number> = { in: 0, low: 1, out: 2 };

    const matched = items
      .filter((i) => {
        if (status && i.status !== status) return false;
        if (!q) return true;
        return matchesStockSearch(i, q);
      })
      .map((item) => ({ item, score: q ? scoreStockSearch(item, q) : 0 }));

    matched.sort((a, b) => {
      if (q && b.score !== a.score) return b.score - a.score;
      const byStatus = statusOrder[a.item.status] - statusOrder[b.item.status];
      if (byStatus !== 0) return byStatus;
      return a.item.name.localeCompare(b.item.name);
    });

    return matched.map((x) => x.item);
  }, [items, search, status]);

  const sales = data?.sales ?? [];
  const receipts = data?.receipts ?? [];

  const salesPeriodLabel = useMemo(
    () => formatSalesPeriodLabel(data?.dateRange),
    [data?.dateRange]
  );

  const stats = useMemo(() => {
    const inStock = items.filter((i) => i.status === "in").length;
    const out = items.filter((i) => i.status === "out").length;
    const totalPcs = items.reduce((s, i) => s + i.count, 0);
    const salesPcs = data?.salesSummary?.totalPcs ?? 0;
    const salesCount = data?.salesSummary?.count ?? 0;
    const receiptsPcs = data?.receiptsSummary?.totalPcs ?? 0;
    const receiptsCount = data?.receiptsSummary?.count ?? 0;
    return { total: items.length, inStock, out, totalPcs, salesPcs, salesCount, receiptsPcs, receiptsCount };
  }, [items, data?.salesSummary, data?.receiptsSummary]);

  function clearFilters() {
    setStatus("");
    setSearch("");
    setExpandedStat(null);
  }

  function handleStatClick(key: StatKey) {
    if (expandedStat === key) {
      setExpandedStat(null);
      setStatus("");
      return;
    }
    setExpandedStat(key);
    setStatus(STAT_FILTER[key]);
  }

  function handleSelectSale(sale: PublicStockSale) {
    const item = items.find((i) => i._id === sale.stockId);
    if (item) setSelectedItem(item);
  }

  function handleSelectReceipt(receipt: PublicStockReceipt) {
    const item = items.find((i) => i._id === receipt.stockId);
    if (item) setSelectedItem(item);
  }

  function refreshPage() {
    load({
      silent: true,
      panel: !!expandedStat,
      from: dateFrom,
      to: dateTo,
      details: !!expandedStat,
    });
  }

  function applyDatePreset(days: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const span = days <= 1 ? 0 : days - 1;
    setDateFrom(toLocalDateString(addLocalDays(today, -span)));
    setDateTo(toLocalDateString(today));
  }

  const searchActive = searchFocused || search.trim().length > 0;

  if (loading && !data) {
    return (
      <div className="stock-view-page flex min-h-screen items-center justify-center">
        <div className="stock-view-pulse flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Loading stock catalogue…</p>
        </div>
      </div>
    );
  }

  return (
    <PublicStockUserProvider publicUser={publicUser}>
    <div className="stock-view-page min-h-screen pb-12">
      <div className="stock-view-sticky-bar">
        <header className="stock-view-header relative overflow-hidden">
          <div className="relative mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full items-center gap-3 sm:gap-4 lg:w-auto">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-amber-400 shadow-md ring-2 ring-amber-500/70 sm:h-14 sm:w-14"
                  title="Tyre stock"
                >
                  <TyreLogoIcon className="h-8 w-8 sm:h-9 sm:w-9" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-black sm:text-2xl">
                    {data?.shopTitle ?? "Tyre Shop"}
                  </h1>
                  <StockSubtitle text={data?.subtitle ?? "Real-time stock status"} />
                </div>
                <button
                  type="button"
                  onClick={() => setUpdateInfoOpen(true)}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 ring-1 ring-amber-200/80 active:scale-95 sm:hidden ${syncFlash ? "stock-view-sync-flash" : ""}`}
                  aria-label="Last stock update"
                  title="Last stock update"
                >
                  <DoNotDisturbIcon className="h-5 w-5" />
                </button>
              </div>

              <div
                className={`hidden w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 ring-1 ring-amber-200/80 sm:flex sm:w-auto sm:min-w-[260px] sm:px-4 ${syncFlash ? "stock-view-sync-flash" : ""}`}
              >
                <DoNotDisturbIcon className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                    Last stock update
                  </p>
                  {data?.lastUserUpdateAt ? (
                    <>
                      <p className="truncate text-xs font-semibold leading-tight text-amber-950 sm:text-sm">
                        {formatDayMonthYear(data.lastUserUpdateAt)} ·{" "}
                        {formatClock(new Date(data.lastUserUpdateAt))}
                      </p>
                      <p className="text-[10px] font-medium text-amber-700">
                        Not live — updated when shop changes stock
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-amber-900">No shop update recorded yet</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={refreshPage}
                  disabled={refreshing}
                  aria-label={refreshing ? "Refreshing page" : "Refresh page"}
                  title={refreshing ? "Refreshing…" : "Refresh page"}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200/80 bg-white text-amber-700 transition hover:bg-amber-100 active:scale-95 disabled:opacity-50 sm:h-9 sm:w-9"
                >
                  <RefreshIcon spinning={refreshing} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 lg:px-8">
          <section
            className="stock-view-stagger rounded-2xl bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 sm:rounded-3xl sm:p-4"
            style={{ animationDelay: "0.06s" }}
          >
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Search tyre pattern, brand, size…"
              className="w-full rounded-2xl border-0 bg-slate-50 py-3.5 pl-12 pr-12 text-sm font-medium text-slate-800 outline-none ring-1 ring-slate-200/80 transition focus:bg-white focus:ring-2 focus:ring-blue-200"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {search.trim() && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              {filtered.length} result{filtered.length === 1 ? "" : "s"} for &ldquo;{search.trim()}&rdquo;
            </p>
          )}
          </section>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {error && (
          <div className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {/* Stats — hidden while search is active */}
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
            searchActive
              ? "mb-2 grid-rows-[0fr] opacity-0"
              : "mb-8 grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="overflow-hidden min-h-0">
        <section className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 sm:shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
              expandedStat ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div className="overflow-hidden">
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-5 lg:p-4">
            <StatCard
              label="Patterns"
              value={stats.total}
              barColor="bg-stone-600"
              iconBg="bg-stone-100"
              iconColor="text-stone-700"
              delay="0.1s"
              active={expandedStat === "all"}
              onClick={() => handleStatClick("all")}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              }
            />
            <StatCard
              label="In stock"
              value={stats.inStock}
              barColor="bg-emerald-500"
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              delay="0.14s"
              active={expandedStat === "in"}
              onClick={() => handleStatClick("in")}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            />
            <StatCard
              label="Out of stock"
              value={stats.out}
              barColor="bg-red-500"
              iconBg="bg-red-50"
              iconColor="text-red-600"
              delay="0.18s"
              active={expandedStat === "out"}
              onClick={() => handleStatClick("out")}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
            />
            <StatCard
              label="Total PCS"
              value={stats.totalPcs.toLocaleString("en-IN")}
              barColor="bg-amber-600"
              iconBg="bg-amber-50"
              iconColor="text-amber-700"
              delay="0.22s"
              active={expandedStat === "pcs"}
              onClick={() => handleStatClick("pcs")}
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
            <StatCard
              label="Sales"
              subLabel={salesPeriodLabel}
              value={stats.salesPcs.toLocaleString("en-IN")}
              barColor="bg-violet-500"
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              delay="0.26s"
              active={expandedStat === "sales"}
              onClick={() => handleStatClick("sales")}
              compact
              hint={
                stats.salesCount > 0
                  ? `${stats.salesCount} ${stats.salesCount === 1 ? "out" : "outs"} · PCS`
                  : "No stock out"
              }
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              }
            />
          </div>
            </div>
          </div>

          <div
            id="stock-stat-detail"
            className={`stock-view-stat-panel grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
              expandedStat ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              {expandedStat && (
                <StatDetailPanel
                  statKey={expandedStat}
                  items={items}
                  stats={stats}
                  sales={sales}
                  receipts={receipts}
                  search={search}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  activityLoading={activityLoading}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  onPreset={applyDatePreset}
                  onSelect={setSelectedItem}
                  onSelectSale={handleSelectSale}
                  onSelectReceipt={handleSelectReceipt}
                  onClose={clearFilters}
                />
              )}
            </div>
          </div>
        </section>
          </div>
        </div>

        <div
          className={`stock-view-patterns-panel grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
            expandedStat && !searchActive
              ? "pointer-events-none grid-rows-[0fr] opacity-0"
              : "grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className="stock-view-stagger mb-5 flex flex-wrap items-center justify-between gap-3"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>
                  {filtered.length} of {items.length} patterns
                </span>
                {data?.lastUserUpdateAt && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200"
                    title="Stock last changed by shop — not a live feed"
                  >
                    <DoNotDisturbIcon className="h-3.5 w-3.5 text-amber-600" />
                    {formatDayMonthYear(data.lastUserUpdateAt)}
                  </span>
                )}
              </div>
              <ViewModeToggle value={viewMode} onChange={handleViewModeChange} />
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-3xl bg-white py-20 text-center shadow-sm ring-1 ring-slate-100">
                <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="mt-3 font-semibold text-slate-600">No patterns found</p>
                <p className="mt-1 text-sm text-slate-400">Try a different search or clear filters</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-stone-800 px-5 py-2 text-sm font-bold text-white"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div key={viewMode} className="stock-view-layout-in">
                {viewMode === "card" ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filtered.map((item, i) => (
                      <PatternCard key={item._id} item={item} index={i} onSelect={setSelectedItem} />
                    ))}
                  </div>
                ) : (
                  <PatternTable items={filtered} onSelect={setSelectedItem} />
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <LastStockUpdateSheet
        open={updateInfoOpen}
        lastUserUpdateAt={data?.lastUserUpdateAt}
        refreshing={refreshing}
        onClose={() => setUpdateInfoOpen(false)}
        onRefresh={refreshPage}
      />

      <PatternDetailSheet
        item={selectedItem}
        shopName={data?.shopTitle}
        onClose={() => setSelectedItem(null)}
      />

      <footer className="mx-auto max-w-7xl px-4 pb-6 text-center sm:px-6">
        <p className="text-xs text-slate-400">{data?.shopTitle} · Godown stock catalogue</p>
      </footer>
    </div>
    </PublicStockUserProvider>
  );
}

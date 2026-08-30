"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { cachedApiJson, cacheKey, LEDGER_DATA_CHANGED, notifyLedgerDataChanged, readClientCache } from "@/lib/clientDataCache";
import { APP_NAME } from "@/lib/brandAssets";
import {
  buildTrackWhatsAppSummary,
  formatSummaryCurrency,
  shareTrackSummaryOnWhatsApp,
  workflowSectionTotal,
  type TrackSummaryFilters,
  type TrackSummaryStats,
} from "@/lib/trackWhatsAppSummary";
import { useConfig } from "../context/ConfigContext";
import { useUser } from "../context/UserContext";
import {
  addLocalDays,
  formatDateDDMMYYYY,
  formatDateRangeLabel,
  inclusiveDayCount,
  toLocalDateString,
} from "@/lib/dateFormat";
import { getCategoryVisual } from "@/lib/categoryVisuals";
import CategoryGlyph from "../components/CategoryGlyph";
import type { Entry } from "@/lib/types";
import { isNilEntry, nilEntryTitle, NIL_DETAIL } from "@/lib/nilEntry";
import {
  canUserModifyEntry,
  canUserRevertOnSiteApproval,
  entryLockShortLabel,
  isAwaitingApprover,
} from "@/lib/paymentWorkflow";
import EditEntrySheet, { EditIcon, TrashIcon } from "../components/EditEntrySheet";
import DeleteEntrySheet from "../components/DeleteEntrySheet";
import ApproveOnSiteSheet from "../components/payments/ApproveOnSiteSheet";
import BulkApproveOnSiteSheet from "../components/payments/BulkApproveOnSiteSheet";
import ReverseOnSiteApprovalButton from "../components/payments/ReverseOnSiteApprovalButton";
import TrackTableScroll from "../components/track/TrackTableScroll";
import { PaymentStatusBadge, PaymentStatusDetail } from "../components/payments/PaymentStatus";
import SyncStatusBadge, { resolveSyncStatus } from "../components/SyncStatusBadge";
import SheetsSyncBanner from "../components/SheetsSyncBanner";
import type { SerializedProduction } from "@/lib/dailyProduction";
import { formatProductionTonnes } from "@/lib/productionDisplay";
import ProductionDayBanner from "../components/salt/ProductionDayBanner";

function formatDate(isoDate: string) {
  return formatDateDDMMYYYY(isoDate);
}

function formatAmount(amount: number) {
  return `₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function groupByDate(entries: Entry[], productionDates: string[] = []) {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = entry.date || "";
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  for (const date of productionDates) {
    if (date && !map.has(date)) map.set(date, []);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

/** Same requested-by person, 2+ pending approvals on one date → bulk approve. */
const MIN_BULK_APPROVE = 2;

function pendingApprovalGroups(rows: Entry[]) {
  const map = new Map<string, Entry[]>();
  for (const entry of rows) {
    if (entry.type !== "expense" || entry.approvalStatus !== "pending") continue;
    if (!canUserModifyEntry(entry)) continue;
    const key = entry.name.trim().toLowerCase();
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length >= MIN_BULK_APPROVE)
    .map(([, list]) => ({ personName: list[0].name, entries: list }));
}

function fieldClass() {
  return "w-full rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-sm text-[#0B4A8C] outline-none transition-colors placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
      {children}
    </label>
  );
}

function TrackPendingDeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-red-200/90"
      aria-label="Delete this entry"
      title="Delete this entry"
    >
      <TrashIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function FilterChip({
  label,
  value,
  onClear,
  highlight,
}: {
  label: string;
  value: string;
  onClear: () => void;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ring-1 ${
        highlight
          ? "bg-[#0B4A8C] text-white ring-[#0B4A8C]"
          : "bg-[#EAF3FB] text-[#0B4A8C] ring-[#C5D9EC]"
      }`}
    >
      <span className={highlight ? "text-white/70" : "text-[#5A7FA5]"}>{label}</span>
      <span className="min-w-0 truncate">{value}</span>
      <button
        type="button"
        onClick={onClear}
        className={`ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] leading-none ${
          highlight ? "bg-white/20 text-white" : "bg-white text-[#5A7FA5]"
        }`}
        aria-label={`Clear ${label}`}
      >
        ×
      </button>
    </span>
  );
}

type Filters = {
  from: string;
  to: string;
  category: string;
  requestedBy: string;
  approvedBy: string;
  paidVia: string;
  search: string;
  workflowStatus: string;
  sheetsSync: string;
};

const EMPTY_FILTERS: Filters = {
  from: "",
  to: "",
  category: "",
  requestedBy: "",
  approvedBy: "",
  paidVia: "",
  search: "",
  workflowStatus: "",
  sheetsSync: "",
};

function filtersToParams(activeFilters: Filters) {
  const params = new URLSearchParams();
  if (activeFilters.from) params.set("from", activeFilters.from);
  if (activeFilters.to) params.set("to", activeFilters.to);
  if (activeFilters.category) params.set("category", activeFilters.category);
  if (activeFilters.requestedBy) params.set("requestedBy", activeFilters.requestedBy);
  if (activeFilters.approvedBy) params.set("approvedBy", activeFilters.approvedBy);
  if (activeFilters.paidVia) params.set("paidVia", activeFilters.paidVia);
  if (activeFilters.search) params.set("search", activeFilters.search);
  if (activeFilters.workflowStatus) params.set("workflowStatus", activeFilters.workflowStatus);
  else params.set("workflowStatus", "all");
  if (activeFilters.sheetsSync) params.set("sheetsSync", activeFilters.sheetsSync);
  return params;
}

function toSummaryFilters(activeFilters: Filters): TrackSummaryFilters {
  return {
    from: activeFilters.from,
    to: activeFilters.to,
    requestedBy: activeFilters.requestedBy,
    category: activeFilters.category,
    approvedBy: activeFilters.approvedBy,
    paidVia: activeFilters.paidVia,
    search: activeFilters.search,
    workflowStatus: activeFilters.workflowStatus,
    sheetsSync: activeFilters.sheetsSync,
  };
}

function filtersFromSearchParams(searchParams: URLSearchParams): Filters {
  const sheetsSync = searchParams.get("sheetsSync") ?? "";
  const workflowFromUrl = searchParams.get("workflowStatus");
  return {
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    category: searchParams.get("category") ?? "",
    requestedBy: searchParams.get("requestedBy") ?? "",
    approvedBy: searchParams.get("approvedBy") ?? "",
    paidVia: searchParams.get("paidVia") ?? "",
    search: searchParams.get("search") ?? "",
    workflowStatus:
      workflowFromUrl === "all"
        ? ""
        : workflowFromUrl || (sheetsSync ? "" : "approval_pending"),
    sheetsSync,
  };
}

export default function TrackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useUser();
  const { config } = useConfig() ?? {};
  const [entries, setEntries] = useState<Entry[]>([]);
  const [productionByDate, setProductionByDate] = useState<Record<string, SerializedProduction>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [requestedByOptions, setRequestedByOptions] = useState<string[]>([]);
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([]);

  const urlFilters = filtersFromSearchParams(searchParams);
  const [filters, setFilters] = useState<Filters>(urlFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(urlFilters);
  const [sharing, setSharing] = useState(false);
  const [summaryStats, setSummaryStats] = useState<TrackSummaryStats | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [approvingEntry, setApprovingEntry] = useState<Entry | null>(null);
  const [bulkApproving, setBulkApproving] = useState<{
    entries: Entry[];
    personName: string;
    date: string;
  } | null>(null);
  const [bankOptions, setBankOptions] = useState<string[]>([]);

  const loadDefaults = useCallback(async () => {
    const res = await apiFetch("/api/defaults");
    if (!res.ok) return;
    const data = await res.json();
    setCategoryOptions(data.expenseCategories ?? []);
    setRequestedByOptions(data.expenseNames ?? []);
    setApprovedByOptions(data.approverNames ?? []);
  }, []);

  const fetchEntries = useCallback(
    async (pageNum: number, activeFilters: Filters, skipCache = false) => {
      const params = filtersToParams(activeFilters);
      params.set("page", String(pageNum));
      params.set("limit", "80");
      const summaryParams = filtersToParams(activeFilters);
      const entriesUrl = `/api/track/entries?${params}`;
      const summaryUrl = `/api/track/summary?${summaryParams}`;

      const hasCache = !skipCache && readClientCache(cacheKey(entriesUrl)) !== null;
      if (!hasCache) {
        setEntries([]);
        setSummaryStats(null);
        setLoading(true);
      }

      try {
        const [entriesResult, summaryResult] = await Promise.all([
          cachedApiJson<{
            entries: Entry[];
            hasMore: boolean;
            total: number;
            page: number;
          }>(entriesUrl, 30_000, { skipCache }),
          cachedApiJson<TrackSummaryStats>(summaryUrl, 30_000, { skipCache }),
        ]);

        if (entriesResult.data) {
          const data = entriesResult.data;
          setEntries(data.entries);
          setHasMore(data.hasMore);
          setTotal(data.total);
          setPage(data.page);
          setAppliedFilters(activeFilters);

          const dateKeys = data.entries.map((entry) => entry.date).filter(Boolean);
          const from = activeFilters.from || (dateKeys.length ? dateKeys.reduce((a, b) => (a < b ? a : b)) : "");
          const to = activeFilters.to || (dateKeys.length ? dateKeys.reduce((a, b) => (a > b ? a : b)) : "");
          if (from && to) {
            const productionResult = await cachedApiJson<{
              productions?: Record<string, SerializedProduction>;
            }>(
              `/api/production?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
              30_000,
              { skipCache }
            );
            setProductionByDate(productionResult.data?.productions ?? {});
          } else {
            setProductionByDate({});
          }
        }
        if (summaryResult.data) {
          setSummaryStats(summaryResult.data);
        }
      } catch (err) {
        console.error("Failed to fetch entries:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const urlKey = searchParams.toString();

  useEffect(() => {
    const next = filtersFromSearchParams(searchParams);
    setFilters(next);
    setEntries([]);
    setSummaryStats(null);
    fetchEntries(1, next, true);
  }, [urlKey, fetchEntries, userId, searchParams]);

  useEffect(() => {
    const onLedger = () => fetchEntries(page, appliedFilters, true);
    window.addEventListener(LEDGER_DATA_CHANGED, onLedger);
    return () => window.removeEventListener(LEDGER_DATA_CHANGED, onLedger);
  }, [fetchEntries, page, appliedFilters]);

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasLedger = features.expenses || features.workers;
    if (config && !hasLedger) {
      router.replace(features.stock ? "/stock" : "/");
    }
  }, [config, router]);

  useEffect(() => {
    loadDefaults();
    apiFetch("/api/defaults")
      .then((r) => (r.ok ? r.json() : { banks: [] }))
      .then((d) => setBankOptions(d.banks ?? []));
  }, [loadDefaults]);

  function commitFilters(next: Filters) {
    setFilters(next);
    const params = filtersToParams(next);
    const qs = params.toString();
    router.replace(qs ? `/track?${qs}` : "/track", { scroll: false });
  }

  function handleFilterChange(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function applyFilters() {
    const next = { ...filters };
    if (next.from && !next.to) next.to = next.from;
    if (next.to && !next.from) next.from = next.to;
    commitFilters(next);
    setShowFilters(false);
  }

  function clearFilters() {
    commitFilters({ ...EMPTY_FILTERS });
    setShowFilters(false);
  }

  function clearFilterKey(key: keyof Filters) {
    if (key === "from" || key === "to") {
      commitFilters({ ...appliedFilters, from: "", to: "" });
      return;
    }
    commitFilters({ ...appliedFilters, [key]: "" });
  }

  function applyWorkflow(status: string) {
    commitFilters({
      ...filters,
      workflowStatus: status,
    });
  }

  function applyPerson(name: string) {
    commitFilters({ ...filters, requestedBy: name });
  }

  function applyCategory(category: string) {
    commitFilters({
      ...filters,
      category: filters.category === category ? "" : category,
    });
  }

  function shiftDates(days: number) {
    const start = filters.from || toLocalDateString();
    const end = filters.to || start;
    const fromDate = addLocalDays(new Date(`${start}T12:00:00`), days);
    const toDate = addLocalDays(new Date(`${end}T12:00:00`), days);
    commitFilters({
      ...filters,
      from: toLocalDateString(fromDate),
      to: toLocalDateString(toDate),
    });
  }

  function setTenDayRange() {
    const to = toLocalDateString();
    const from = toLocalDateString(addLocalDays(new Date(`${to}T12:00:00`), -9));
    commitFilters({ ...filters, from, to });
    setShowFilters(false);
  }

  function nextPage() {
    if (hasMore) fetchEntries(page + 1, appliedFilters);
  }

  function prevPage() {
    if (page > 1) fetchEntries(page - 1, appliedFilters);
  }

  async function shareSummary() {
    if (total === 0 || sharing) return;
    setSharing(true);
    try {
      let stats = summaryStats;
      if (!stats) {
        const params = filtersToParams(appliedFilters);
        const res = await apiFetch(`/api/track/summary?${params}`);
        if (!res.ok) throw new Error("Summary failed");
        stats = (await res.json()) as TrackSummaryStats;
        setSummaryStats(stats);
      }
      if (!stats) return;
      const appName = config?.branding?.appName?.trim() || APP_NAME;
      const text = buildTrackWhatsAppSummary(appName, toSummaryFilters(appliedFilters), stats);
      shareTrackSummaryOnWhatsApp(text);
    } catch (err) {
      console.error("Failed to share summary:", err);
    } finally {
      window.setTimeout(() => setSharing(false), 2500);
    }
  }

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers) return null;

  const extraFilterCount = [
    appliedFilters.approvedBy,
    appliedFilters.paidVia,
    appliedFilters.sheetsSync,
    appliedFilters.search,
  ].filter((value) => value.trim() !== "").length;
  const dateGroups = groupByDate(entries, Object.keys(productionByDate));
  const rangeTonnes = Object.values(productionByDate).reduce((sum, row) => sum + row.tonnes, 0);
  const productionDayCount = Object.keys(productionByDate).length;
  const categoryTotals = summaryStats?.categoryBreakdown ?? [];
  const rangeLabel = formatDateRangeLabel(appliedFilters.from, appliedFilters.to);
  const rangeDays =
    appliedFilters.from && appliedFilters.to
      ? inclusiveDayCount(appliedFilters.from, appliedFilters.to)
      : 0;
  const hasDateFilter = Boolean(appliedFilters.from || appliedFilters.to);
  const hasChipFilters =
    hasDateFilter ||
    Boolean(
      appliedFilters.approvedBy ||
        appliedFilters.paidVia ||
        appliedFilters.sheetsSync ||
        appliedFilters.search
    );

  const sectionTotal = workflowSectionTotal(
    appliedFilters.workflowStatus,
    summaryStats?.workflowTotals ?? {
      pendingApproval: { amount: 0, count: 0 },
      paymentPending: { amount: 0, count: 0 },
      paidVerified: { amount: 0, count: 0 },
    }
  );
  const sectionTotalTitle = appliedFilters.requestedBy
    ? `${appliedFilters.requestedBy} · ${sectionTotal.label}`
    : sectionTotal.label;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto max-w-2xl px-4 py-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0B4A8C] shadow-sm ring-1 ring-[#D6E6F5]"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-lg font-extrabold tracking-wide text-[#0B4A8C]">Expense Report</h1>
            <p className="text-[11px] font-medium text-[#5A7FA5]">{rangeLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full ring-1 ${
              showFilters || extraFilterCount > 0
                ? "bg-[#0B4A8C] text-white ring-[#0B4A8C]"
                : "bg-white text-[#0B4A8C] ring-[#D6E6F5]"
            }`}
            aria-label="Filters"
            aria-expanded={showFilters}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {extraFilterCount > 0 && !showFilters ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C9A227] px-1 text-[9px] font-extrabold text-white">
                {extraFilterCount}
              </span>
            ) : null}
          </button>
        </header>

        <div className="mb-4">
          <SheetsSyncBanner onRefresh={() => fetchEntries(page, appliedFilters)} />
        </div>

        {hasChipFilters && (
          <div className="mb-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-[#D6E6F5]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">Selected filters</p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-semibold text-[#3D7AB8]"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hasDateFilter ? (
                <FilterChip
                  highlight
                  label="Dates"
                  value={rangeLabel}
                  onClear={() => clearFilterKey("from")}
                />
              ) : null}
              {appliedFilters.approvedBy ? (
                <FilterChip
                  label="Approved"
                  value={appliedFilters.approvedBy}
                  onClear={() => clearFilterKey("approvedBy")}
                />
              ) : null}
              {appliedFilters.paidVia ? (
                <FilterChip
                  label="Paid via"
                  value={appliedFilters.paidVia}
                  onClear={() => clearFilterKey("paidVia")}
                />
              ) : null}
              {appliedFilters.sheetsSync ? (
                <FilterChip
                  label="Sync"
                  value={appliedFilters.sheetsSync === "failed" ? "Sync failed" : "Pending sync"}
                  onClear={() => clearFilterKey("sheetsSync")}
                />
              ) : null}
              {appliedFilters.search ? (
                <FilterChip
                  label="Search"
                  value={appliedFilters.search}
                  onClear={() => clearFilterKey("search")}
                />
              ) : null}
            </div>
          </div>
        )}

        <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 -mx-4 mb-3 space-y-2 border-b border-[#D6E6F5]/80 bg-[var(--background)]/95 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl bg-white px-1 py-1 shadow-sm ring-1 ring-[#D6E6F5]">
              <button
                type="button"
                onClick={() => shiftDates(-1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#0B4A8C] hover:bg-[#F4F8FC]"
                aria-label="Previous day"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="min-w-0 flex-1 py-0.5 text-center"
              >
                <p className="truncate text-sm font-bold text-[#0B4A8C]">{rangeLabel}</p>
                <p className="truncate text-[10px] font-medium text-[#7A9BB8]">
                  {hasDateFilter && rangeDays > 1
                    ? `${rangeDays} days`
                    : hasDateFilter
                      ? "One day"
                      : "All dates"}
                </p>
              </button>
              <button
                type="button"
                onClick={() => shiftDates(1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#0B4A8C] hover:bg-[#F4F8FC]"
                aria-label="Next day"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex shrink-0 rounded-full bg-white p-1 shadow-sm ring-1 ring-[#D6E6F5]">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold ${
                  viewMode === "table" ? "bg-[#0B4A8C] text-white" : "text-[#5A7FA5]"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold ${
                  viewMode === "cards" ? "bg-[#0B4A8C] text-white" : "text-[#5A7FA5]"
                }`}
              >
                Cards
              </button>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[#D6E6F5]">
            <button
              type="button"
              onClick={() => applyPerson("")}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${
                !appliedFilters.requestedBy ? "bg-[#0B4A8C] text-white" : "text-[#5A7FA5]"
              }`}
            >
              All
            </button>
            {requestedByOptions.map((name, index) => {
              const active = appliedFilters.requestedBy === name;
              const tone = index % 2 === 0 ? "bg-emerald-600" : "bg-violet-600";
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyPerson(name)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${
                    active ? `${tone} text-white` : "text-[#5A7FA5]"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => applyCategory("")}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 ring-1 ${
                !appliedFilters.category
                  ? "bg-[#0B4A8C] text-white ring-[#0B4A8C]"
                  : "bg-white text-[#5A7FA5] ring-[#D6E6F5]"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </span>
              <span className="text-[10px] font-bold">All</span>
            </button>
            {(categoryOptions.length > 0 ? categoryOptions : categoryTotals.map((row) => row.label)).map(
              (category) => {
                const visual = getCategoryVisual(category);
                const active = appliedFilters.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => applyCategory(category)}
                    className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 ring-1 ${
                      active ? `${visual.chip} ring-2` : "bg-white text-[#5A7FA5] ring-[#D6E6F5]"
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${visual.chip}`}>
                      <CategoryGlyph icon={visual.icon} />
                    </span>
                    <span className="max-w-[4.5rem] truncate text-[10px] font-bold">{visual.shortLabel}</span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {categoryTotals.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#5A7FA5]">
              {appliedFilters.requestedBy ? `${appliedFilters.requestedBy} summary` : "Category summary"}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categoryTotals.slice(0, 8).map((row) => {
                const visual = getCategoryVisual(row.label);
                return (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => applyCategory(row.label)}
                    className={`min-w-[6.5rem] rounded-2xl bg-gradient-to-b p-3 text-left shadow-sm ring-1 ${visual.tile}`}
                  >
                    <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${visual.chip}`}>
                      <CategoryGlyph icon={visual.icon} />
                    </span>
                    <p className="truncate text-[11px] font-bold text-[#0B4A8C]">{visual.shortLabel}</p>
                    <p className={`mt-1 text-sm font-extrabold tabular-nums ${visual.amount}`}>
                      {formatSummaryCurrency(row.amount)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {productionDayCount > 0 && (
          <div className="mb-4 rounded-2xl border border-[#E8B84A] bg-[#FFF8E7] px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9A5B0C]">
              Salt production · {hasDateFilter ? rangeLabel : "Loaded dates"}
            </p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-[#7C3D00]">
              {formatProductionTonnes(rangeTonnes)} t
            </p>
            <p className="text-[11px] font-medium text-[#A16207]">
              {productionDayCount} {productionDayCount === 1 ? "day" : "days"}
              {hasDateFilter ? ". Change From / To at the top to filter this total." : "."}
            </p>
          </div>
        )}

        <section>
          {summaryStats && (
            <div className="mb-4">
              <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#D6E6F5]">
                <div className="grid grid-cols-3">
                  <WorkflowTab
                    label="Pending"
                    amount={summaryStats.workflowTotals.pendingApproval.amount}
                    count={summaryStats.workflowTotals.pendingApproval.count}
                    selected={appliedFilters.workflowStatus === "approval_pending"}
                    tone="brand"
                    icon="pending"
                    onClick={() => applyWorkflow("approval_pending")}
                  />
                  <WorkflowTab
                    label="To pay"
                    amount={summaryStats.workflowTotals.paymentPending.amount}
                    count={summaryStats.workflowTotals.paymentPending.count}
                    selected={appliedFilters.workflowStatus === "payment_pending"}
                    tone="gold"
                    icon="pay"
                    onClick={() => applyWorkflow("payment_pending")}
                  />
                  <WorkflowTab
                    label="Paid"
                    amount={summaryStats.workflowTotals.paidVerified.amount}
                    count={summaryStats.workflowTotals.paidVerified.count}
                    selected={appliedFilters.workflowStatus === "paid"}
                    tone="brand"
                    icon="paid"
                    onClick={() => applyWorkflow("paid")}
                  />
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-[#5A7FA5]">
                Showing{" "}
                <span className="font-bold text-[#0B4A8C]">
                  {appliedFilters.workflowStatus === "payment_pending"
                    ? "Payment pending"
                    : appliedFilters.workflowStatus === "paid"
                      ? "Paid / verified"
                      : appliedFilters.workflowStatus === "approval_pending"
                        ? "Pending approval"
                        : "All statuses"}
                </span>
              </p>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A7FA5]">
              Date wise details ({total})
            </h2>
            <div className="flex items-center gap-2">
              {total > 0 && (
                <button
                  type="button"
                  onClick={shareSummary}
                  disabled={sharing || loading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366]/30 bg-[#EFFFF4] px-3 py-1.5 text-xs font-bold text-[#128C7E] disabled:opacity-50"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  {sharing ? "Preparing…" : "Share"}
                </button>
              )}
              {page > 1 && (
                <button
                  type="button"
                  onClick={prevPage}
                  disabled={loading}
                  className="text-xs font-semibold text-[#0B4A8C] disabled:opacity-50"
                >
                  ← Prev
                </button>
              )}
              {hasMore && (
                <button
                  type="button"
                  onClick={nextPage}
                  disabled={loading}
                  className="text-xs font-semibold text-[#0B4A8C] disabled:opacity-50"
                >
                  Next →
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B4A8C] border-t-transparent" />
            </div>
          ) : entries.length === 0 && dateGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#B8CDE3] bg-white px-4 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF5FC] text-[#0B4A8C]">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#0B4A8C]">Nothing in this section</p>
              <p className="mt-1 text-xs text-[#5A7FA5]">
                {appliedFilters.workflowStatus === "payment_pending"
                  ? "No entries waiting for admin payment. Tap Pending or Paid above."
                  : appliedFilters.workflowStatus === "paid"
                    ? "No paid entries for these filters. Tap Pending or To pay above."
                    : "No pending-approval entries. Tap To pay or Paid to see the next section."}
              </p>
            </div>
          ) : viewMode === "table" ? (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-[#D6E6F5]">
              {dateGroups.map(([date, rows], index) => {
                const open = (expandedDate ?? dateGroups[0]?.[0]) === date;
                const dayTotal = rows
                  .filter((entry) => entry.type === "expense")
                  .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
                return (
                  <div key={date} className="border-b border-slate-100 last:border-0">
                    <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0B4A8C]">{formatDate(date)}</p>
                        <p className="text-[10px] font-medium text-[#7A9BB8]">
                          {rows.length} {rows.length === 1 ? "entry" : "entries"}
                          {index === 0 ? " · Latest" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold tabular-nums text-[#0B4A8C]">
                          {formatAmount(dayTotal)}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDate(open ? "" : date);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#7A9BB8] hover:bg-[#F4F8FC]"
                          aria-expanded={open}
                          aria-label={open ? "Collapse date" : "Expand date"}
                        >
                          <svg
                            className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div>
                        {pendingApprovalGroups(rows).map((group) => {
                          const groupTotal = group.entries.reduce(
                            (sum, entry) => sum + Math.abs(entry.amount),
                            0
                          );
                          return (
                            <div
                              key={`${date}-${group.personName}`}
                              className="flex items-center justify-between gap-2 border-b border-[#E8F0F7] bg-[#FFFBEB] px-4 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-[#5C4A0A]">
                                  {group.personName} · {group.entries.length} need approval
                                </p>
                                <p className="text-[10px] text-[#8A7428]">
                                  ₹{groupTotal.toLocaleString("en-IN")} total
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setBulkApproving({
                                    entries: group.entries,
                                    personName: group.personName,
                                    date,
                                  })
                                }
                                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0B4A8C] px-3 py-2 text-xs font-bold text-white"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Approve all
                              </button>
                            </div>
                          );
                        })}
                        <TrackTableScroll>
                          <table className="track-table text-left">
                            <colgroup>
                              <col style={{ width: "28%" }} />
                              <col />
                              <col style={{ width: "5.5rem" }} />
                              <col className="track-col-status" />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-[#7A9BB8]">
                                <th className="px-2 py-2">Category</th>
                                <th className="px-2 py-2">Detail</th>
                                <th className="px-2 py-2 text-right">Amount</th>
                                <th className="track-col-status px-2 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((entry) => {
                                const visual = getCategoryVisual(entry.category || "Other");
                                const openRow = expandedId === entry._id;
                                const canRevert = canUserRevertOnSiteApproval(entry);
                                return (
                                  <tr
                                    key={entry._id}
                                    className={`border-t border-slate-100 ${openRow ? "bg-[#F8FBFE]" : ""}`}
                                  >
                                    <td className="px-2 py-2.5 align-top">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedId(openRow ? null : entry._id ?? null)
                                        }
                                        className="flex w-full items-start gap-1.5 text-left"
                                      >
                                        <span
                                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${visual.chip}`}
                                        >
                                          <CategoryGlyph icon={visual.icon} />
                                        </span>
                                        <span className="min-w-0 break-words text-[11px] font-bold leading-snug text-[#0B4A8C]">
                                          {entry.category || "Other"}
                                        </span>
                                      </button>
                                    </td>
                                    <td className="px-2 py-2.5 align-top text-[#5A7FA5]">
                                      <p className="break-words text-xs font-medium leading-snug text-[#0B4A8C]">
                                        {isNilEntry(entry) ? NIL_DETAIL : entry.name}
                                      </p>
                                      {isNilEntry(entry) ? null : (
                                      <p className="mt-0.5 break-words text-[11px] leading-snug">
                                        {entry.note || entry.method}
                                      </p>
                                      )}
                                    </td>
                                    <td className="px-2 py-2.5 align-top text-right">
                                      <span
                                        className={`whitespace-nowrap text-[11px] font-extrabold tabular-nums ${visual.amount}`}
                                      >
                                        {isNilEntry(entry) ? "Nil" : formatAmount(entry.amount)}
                                      </span>
                                    </td>
                                    <td className="track-col-status px-2 py-2.5 align-top">
                                      <div className="flex flex-nowrap items-center gap-1">
                                        <PaymentStatusBadge
                                          entry={entry}
                                          iconOnly={isAwaitingApprover(entry)}
                                          onPendingApprovalClick={
                                            canUserModifyEntry(entry) && isAwaitingApprover(entry)
                                              ? () => setApprovingEntry(entry)
                                              : undefined
                                          }
                                        />
                                        {canUserModifyEntry(entry) &&
                                        (isAwaitingApprover(entry) || isNilEntry(entry)) ? (
                                          <TrackPendingDeleteButton onDelete={() => setDeletingEntry(entry)} />
                                        ) : null}
                                        {canRevert ? (
                                          <ReverseOnSiteApprovalButton
                                            entry={entry}
                                            iconOnly
                                            onReverted={() => {
                                              notifyLedgerDataChanged();
                                            }}
                                          />
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </TrackTableScroll>
                        {rows
                          .filter((entry) => entry._id === expandedId)
                          .map((entry) => {
                            const canModify = canUserModifyEntry(entry);
                            const nilDay = isNilEntry(entry);
                            const needsOnSiteApproval =
                              !nilDay && entry.type === "expense" && entry.approvalStatus === "pending";
                            return (
                              <div key={`${entry._id}-detail`} className="border-t border-[#D6E6F5] bg-[#F8FBFE] px-4 py-3">
                                {canModify && (
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setDeletingEntry(entry)}
                                      className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                                      aria-label="Delete"
                                    >
                                      <TrashIcon />
                                    </button>
                                    {needsOnSiteApproval ? (
                                      <button
                                        type="button"
                                        onClick={() => setApprovingEntry(entry)}
                                        className="flex items-center gap-1.5 rounded-xl bg-[#0B4A8C] px-4 py-2.5 text-sm font-semibold text-white"
                                      >
                                        Set approved by
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setEditingEntry(entry)}
                                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#0B4A8C]"
                                      >
                                        <EditIcon />
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                )}
                                {nilDay ? (
                                  <p className="text-sm font-medium text-[#0B4A8C]">{NIL_DETAIL}</p>
                                ) : (
                                  <PaymentStatusDetail entry={entry} />
                                )}
                              </div>
                            );
                          })}
                        <ProductionDayBanner date={date} production={productionByDate[date]} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const isExpanded = expandedId === entry._id;
                const canModify = canUserModifyEntry(entry);
                const nilDay = isNilEntry(entry);
                const needsOnSiteApproval =
                  !nilDay && entry.type === "expense" && entry.approvalStatus === "pending";
                return (
                  <div
                    key={entry._id}
                    className="overflow-hidden rounded-2xl border border-[#D6E6F5] bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry._id ?? null)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#0B4A8C]">
                          {nilDay ? nilEntryTitle(entry) : entry.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#5A7FA5]">
                          {formatDate(entry.date)}
                          {nilDay
                            ? ` · ${NIL_DETAIL}`
                            : `${entry.category ? ` · ${entry.category}` : ""} · ${entry.method}`}
                        </p>
                        {entry.approvedBy && (
                          <p className="mt-0.5 truncate text-[10px] text-[#7A9BB8]">
                            Approved: {entry.approvedBy}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <PaymentStatusBadge
                            entry={entry}
                            iconOnly={isAwaitingApprover(entry)}
                            onPendingApprovalClick={
                              canModify && isAwaitingApprover(entry)
                                ? () => setApprovingEntry(entry)
                                : undefined
                            }
                          />
                          {canModify && (isAwaitingApprover(entry) || nilDay) ? (
                            <TrackPendingDeleteButton onDelete={() => setDeletingEntry(entry)} />
                          ) : null}
                          {canUserRevertOnSiteApproval(entry) ? (
                            <ReverseOnSiteApprovalButton
                              entry={entry}
                              iconOnly
                              onReverted={() => {
                                notifyLedgerDataChanged();
                              }}
                            />
                          ) : null}
                          <SyncStatusBadge status={resolveSyncStatus(entry)} compact />
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold tabular-nums text-[#0B4A8C]">
                            {nilDay ? "Nil" : formatAmount(entry.amount)}
                          </p>
                          {!canModify && (
                            <span className="max-w-[7.5rem] text-right text-[10px] font-semibold leading-tight text-amber-800">
                              {entryLockShortLabel(entry)}
                            </span>
                          )}
                          <svg
                          className={`h-4 w-4 text-[#7A9BB8] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#D6E6F5] bg-[#F8FBFE] px-4 py-3">
                        {canModify && (
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setDeletingEntry(entry)}
                              className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                              aria-label="Delete"
                            >
                              <TrashIcon />
                            </button>
                            {needsOnSiteApproval ? (
                              <button
                                type="button"
                                onClick={() => setApprovingEntry(entry)}
                                className="flex items-center gap-1.5 rounded-xl bg-[#0B4A8C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.98]"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Set approved by
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingEntry(entry)}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#0B4A8C] hover:bg-[#E8F2FC]"
                              >
                                <EditIcon />
                                Edit
                              </button>
                            )}
                          </div>
                        )}
                        <dl className="space-y-2 text-sm">
                          <Row label="Date" value={formatDate(entry.date)} />
                          {entry.category && <Row label="Category" value={entry.category} />}
                          {nilDay ? (
                            <>
                              <Row label="Amount" value="Nil" />
                              <Row label="Detail" value={NIL_DETAIL} />
                            </>
                          ) : (
                            <>
                          <Row label="Amount" value={formatAmount(entry.amount)} />
                          <Row label="Payment" value={entry.method} />
                          <Row label="Requested by" value={entry.name} />
                          {entry.approvedBy && <Row label="Approved by" value={entry.approvedBy} />}
                          {entry.note && <Row label="Notes" value={entry.note} />}
                            </>
                          )}
                          {nilDay ? null : <PaymentStatusDetail entry={entry} />}
                          {entry.attachmentUrl && (
                            <div className="flex justify-between gap-4">
                              <dt className="text-[#5A7FA5]">Attachment</dt>
                              <dd>
                                <a
                                  href={entry.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-[#0B4A8C] underline"
                                >
                                  View
                                </a>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!loading && summaryStats ? (
            <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-[#D6E6F5]">
              <SectionTotalBar
                title={sectionTotalTitle}
                amount={sectionTotal.amount}
                count={sectionTotal.count}
                tone={sectionTotal.tone}
                icon={sectionTotal.icon}
              />
            </div>
          ) : null}
        </section>

        {bulkApproving && (
          <BulkApproveOnSiteSheet
            entries={bulkApproving.entries}
            personName={bulkApproving.personName}
            date={bulkApproving.date}
            onClose={() => setBulkApproving(null)}
            onSuccess={() => {
              const ids = new Set(bulkApproving.entries.map((e) => e._id));
              setEntries((prev) => prev.filter((entry) => !ids.has(entry._id)));
              setTotal((t) => Math.max(0, t - bulkApproving.entries.length));
              setBulkApproving(null);
              notifyLedgerDataChanged();
            }}
          />
        )}

        {approvingEntry && (
          <ApproveOnSiteSheet
            entry={approvingEntry}
            onClose={() => setApprovingEntry(null)}
            onSuccess={() => {
              const id = approvingEntry._id;
              setEntries((prev) => prev.filter((entry) => entry._id !== id));
              setTotal((t) => Math.max(0, t - 1));
              setApprovingEntry(null);
              notifyLedgerDataChanged();
            }}
            onEditDetails={() => {
              setEditingEntry(approvingEntry);
              setApprovingEntry(null);
            }}
          />
        )}

        {deletingEntry && (
          <DeleteEntrySheet
            entry={deletingEntry}
            onClose={() => setDeletingEntry(null)}
            onSuccess={() => {
              const id = deletingEntry._id;
              setEntries((prev) => prev.filter((e) => e._id !== id));
              setTotal((t) => Math.max(0, t - 1));
              setExpandedId(null);
              setDeletingEntry(null);
              notifyLedgerDataChanged();
            }}
          />
        )}

        {editingEntry && (
          <EditEntrySheet
            entry={editingEntry}
            bankOptions={bankOptions}
            hideApprovalField={editingEntry.approvalStatus === "pending"}
            onClose={() => setEditingEntry(null)}
            onSuccess={() => {
              setEditingEntry(null);
              notifyLedgerDataChanged();
            }}
          />
        )}
      </div>

      {showFilters ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-[#E8F0F7] px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-[#0B4A8C]">Filters</h2>
                <p className="text-[11px] font-medium text-[#5A7FA5]">
                  {formatDateRangeLabel(filters.from, filters.to)}
                  {filters.from && filters.to && filters.from !== filters.to
                    ? ` · ${inclusiveDayCount(filters.from, filters.to)} days`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#5A7FA5]"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto px-4 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>From date</FieldLabel>
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => handleFilterChange("from", e.target.value)}
                    className={fieldClass()}
                  />
                </div>
                <div>
                  <FieldLabel>To date</FieldLabel>
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) => handleFilterChange("to", e.target.value)}
                    className={fieldClass()}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={setTenDayRange}
                className="w-full rounded-xl bg-[#F4F8FC] py-2 text-xs font-bold text-[#0B4A8C]"
              >
                Last 10 days
              </button>

              <div>
                <FieldLabel>Approved by</FieldLabel>
                <select
                  value={filters.approvedBy}
                  onChange={(e) => handleFilterChange("approvedBy", e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">All</option>
                  {approvedByOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Sheets sync</FieldLabel>
                <select
                  value={filters.sheetsSync}
                  onChange={(e) => handleFilterChange("sheetsSync", e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">All</option>
                  <option value="pending">Pending sync</option>
                  <option value="failed">Sync failed</option>
                </select>
              </div>

              <div>
                <FieldLabel>Paid via (admin)</FieldLabel>
                <select
                  value={filters.paidVia}
                  onChange={(e) => handleFilterChange("paidVia", e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">All</option>
                  <option value="Cash">Cash</option>
                  <option value="GPay">GPay / UPI</option>
                  <option value="Bank">Bank transfer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 border-t border-[#E8F0F7] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 rounded-xl bg-[#F4F8FC] py-3 text-sm font-bold text-[#0B4A8C]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="flex-[2] rounded-xl bg-[#0B4A8C] py-3 text-sm font-bold text-white"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionTotalBar({
  title,
  amount,
  count,
  tone,
  icon,
}: {
  title: string;
  amount: number;
  count: number;
  tone: "gold" | "brand";
  icon: "pending" | "pay" | "paid";
}) {
  const barClass = tone === "gold" ? "bg-amber-600" : "bg-[#0B4A8C]";

  return (
    <div className={`flex items-center justify-between px-4 py-3.5 text-white ${barClass}`}>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{title}</p>
        <p className="mt-0.5 text-xl font-extrabold tabular-nums leading-none">
          {formatSummaryCurrency(amount)}
        </p>
        <p className="mt-1 text-[11px] font-medium text-white/75">
          {count} {count === 1 ? "entry" : "entries"}
        </p>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <SectionIcon kind={icon} />
      </span>
    </div>
  );
}

function WorkflowTab({
  label,
  amount,
  count,
  tone,
  selected = false,
  icon,
  onClick,
}: {
  label: string;
  amount: number;
  count: number;
  tone: "slate" | "gold" | "brand";
  selected?: boolean;
  icon: "pending" | "pay" | "paid";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "gold"
      ? selected
        ? "bg-amber-50 text-amber-900"
        : "text-[#7A5E10]"
      : selected
        ? "bg-[#EEF5FC] text-[#0B4A8C]"
        : "text-[#0B4A8C]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-1 py-3 ${toneClass} ${
        selected ? "ring-2 ring-inset ring-[#0B4A8C]" : ""
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
        <SectionIcon kind={icon} />
      </span>
      <p className="text-[10px] font-bold leading-tight">{label}</p>
      <p className="text-sm font-bold tabular-nums">{formatSummaryCurrency(amount)}</p>
      <p className="text-[10px] opacity-70">
        {count} {count === 1 ? "entry" : "entries"}
      </p>
    </button>
  );
}

function SectionIcon({ kind }: { kind: "pending" | "pay" | "paid" }) {
  const className = "h-4 w-4";
  if (kind === "pending") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (kind === "pay") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#5A7FA5]">{label}</dt>
      <dd className="text-right font-medium text-[#0B4A8C]">{value}</dd>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

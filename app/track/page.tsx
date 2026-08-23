"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { cachedApiJson, cacheKey, notifyLedgerDataChanged, readClientCache } from "@/lib/clientDataCache";
import { APP_NAME } from "@/lib/brandAssets";
import {
  buildTrackWhatsAppSummary,
  formatSummaryCurrency,
  shareTrackSummaryOnWhatsApp,
  type TrackSummaryFilters,
  type TrackSummaryStats,
} from "@/lib/trackWhatsAppSummary";
import { useConfig } from "../context/ConfigContext";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import type { Entry } from "@/lib/types";
import { canUserModifyEntry } from "@/lib/paymentWorkflow";
import EditEntrySheet, { EditIcon, LockIcon, TrashIcon } from "../components/EditEntrySheet";
import ApproveOnSiteSheet from "../components/payments/ApproveOnSiteSheet";
import { PaymentStatusBadge, PaymentStatusDetail } from "../components/payments/PaymentStatus";
import SyncStatusBadge, { resolveSyncStatus } from "../components/SyncStatusBadge";
import SheetsSyncBanner from "../components/SheetsSyncBanner";
import { useUser } from "../context/UserContext";

function formatDate(isoDate: string) {
  return formatDateDDMMYYYY(isoDate);
}

function formatAmount(amount: number) {
  return `₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
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

export default function TrackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userName } = useUser();
  const { config } = useConfig() ?? {};
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [requestedByOptions, setRequestedByOptions] = useState<string[]>([]);
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([]);

  const urlFrom = searchParams.get("from") ?? "";
  const urlTo = searchParams.get("to") ?? "";
  const urlWorkflow = searchParams.get("workflowStatus") ?? "";
  const urlSheetsSync = searchParams.get("sheetsSync") ?? "";
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    from: urlFrom,
    to: urlTo,
    workflowStatus: urlWorkflow,
    sheetsSync: urlSheetsSync,
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    from: urlFrom,
    to: urlTo,
    workflowStatus: urlWorkflow,
    sheetsSync: urlSheetsSync,
  });
  const [sharing, setSharing] = useState(false);
  const [summaryStats, setSummaryStats] = useState<TrackSummaryStats | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [approvingEntry, setApprovingEntry] = useState<Entry | null>(null);
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
    async (pageNum: number, activeFilters: Filters) => {
      const params = filtersToParams(activeFilters);
      params.set("page", String(pageNum));
      params.set("limit", "15");
      const summaryParams = filtersToParams(activeFilters);
      const entriesUrl = `/api/track/entries?${params}`;
      const summaryUrl = `/api/track/summary?${summaryParams}`;

      const hasCache = readClientCache(cacheKey(entriesUrl)) !== null;
      if (!hasCache) setLoading(true);

      try {
        const [entriesResult, summaryResult] = await Promise.all([
          cachedApiJson<{
            entries: Entry[];
            hasMore: boolean;
            total: number;
            page: number;
          }>(entriesUrl, 30_000),
          cachedApiJson<TrackSummaryStats>(summaryUrl, 30_000),
        ]);

        if (entriesResult.data) {
          const data = entriesResult.data;
          setEntries(data.entries);
          setHasMore(data.hasMore);
          setTotal(data.total);
          setPage(data.page);
          setAppliedFilters(activeFilters);
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

  useEffect(() => {
    const next: Filters = {
      ...EMPTY_FILTERS,
      from: urlFrom,
      to: urlTo,
      workflowStatus: urlWorkflow,
      sheetsSync: urlSheetsSync,
    };
    setFilters(next);
    if (urlFrom || urlTo || urlWorkflow || urlSheetsSync) {
      setShowFilters(true);
    }
    fetchEntries(1, next);
  }, [urlFrom, urlTo, urlWorkflow, urlSheetsSync, fetchEntries]);

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

  async function handleDelete(entry: Entry) {
    const reason = prompt("Reason for deletion (required):");
    if (!reason?.trim()) return;
    if (!confirm("Delete this entry?")) return;
    try {
      const res = await apiFetch(`/api/entries/${entry._id}/adjust`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), editedBy: userName || "User" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Delete failed");
        return;
      }
      setEntries((prev) => prev.filter((e) => e._id !== entry._id));
      setTotal((t) => Math.max(0, t - 1));
      setExpandedId(null);
      notifyLedgerDataChanged();
    } catch {
      alert("Delete failed");
    }
  }

  function handleFilterChange(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function applyFilters() {
    fetchEntries(1, filters);
  }

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    fetchEntries(1, EMPTY_FILTERS);
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
        stats = await res.json();
        setSummaryStats(stats);
      }
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

  const hasActiveFilters = Object.entries(filters).some(([, v]) => v.trim() !== "");

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto max-w-md px-4 py-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0B4A8C] shadow-sm"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold tracking-wide text-[#0B4A8C]">Track</h1>
            <p className="text-xs text-[#5A7FA5]">Search & filter expense entries</p>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="rounded-xl border border-[#D6E6F5] bg-white px-3 py-2 text-xs font-semibold text-[#0B4A8C]"
          >
            {showFilters ? "Hide" : "Filters"}
          </button>
        </header>

        <div className="mb-4">
          <SheetsSyncBanner onRefresh={() => fetchEntries(page, appliedFilters)} />
        </div>

        <div className="mb-4 rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
          <FieldLabel>Search anything</FieldLabel>
          <div className="flex gap-2">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Name, category, amount, note, payment…"
              className={fieldClass()}
            />
            <button
              type="button"
              onClick={applyFilters}
              className="shrink-0 rounded-xl bg-[#0B4A8C] px-4 text-sm font-bold text-white"
            >
              Go
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-[#7A9BB8]">
            Searches all fields: requested by, approved by, category, amount, notes
          </p>
        </div>

        {showFilters && (
          <div className="mb-4 space-y-3 rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0B4A8C]">Filters</h2>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-semibold text-[#3D7AB8]"
                >
                  Clear all
                </button>
              )}
            </div>

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

            <div>
              <FieldLabel>Category</FieldLabel>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className={fieldClass()}
              >
                <option value="">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Requested by</FieldLabel>
                <select
                  value={filters.requestedBy}
                  onChange={(e) => handleFilterChange("requestedBy", e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">All</option>
                  {requestedByOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
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
              <p className="mt-1 text-[10px] text-[#7A9BB8]">
                How admin paid — only shows verified/paid entries.
              </p>
            </div>

            <div>
              <FieldLabel>Approval / Payment status</FieldLabel>
              <select
                value={filters.workflowStatus}
                onChange={(e) => handleFilterChange("workflowStatus", e.target.value)}
                className={fieldClass()}
              >
                <option value="">All statuses</option>
                <option value="approval_pending">📋 Pending Approval (needs Approved by)</option>
                <option value="payment_pending">💳 Payment Pending (admin pays)</option>
                <option value="paid">🟢 Paid / Verified (locked)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-xl bg-[#0B4A8C] py-3.5 text-sm font-bold text-white"
            >
              Apply Filters
            </button>
          </div>
        )}

        <section>
          {summaryStats && total > 0 && (
            <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 -mx-4 mb-4 bg-[var(--background)]/95 px-4 py-2 backdrop-blur-md">
              <div className="ui-card overflow-hidden p-0 shadow-md ring-1 ring-[var(--border-soft)]">
                <div className="bg-gradient-to-br from-[#0B4A8C] to-[#062f5c] px-4 py-3.5 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">
                    Payment overview
                  </p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                    {formatSummaryCurrency(summaryStats.totalAmount)}
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    {summaryStats.totalEntries} entr{summaryStats.totalEntries === 1 ? "y" : "ies"}{" "}
                    in results
                  </p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white">
                  <TrackSummaryStat
                    label="Pending approval"
                    amount={summaryStats.workflowTotals.pendingApproval.amount}
                    count={summaryStats.workflowTotals.pendingApproval.count}
                    tone="slate"
                  />
                  <TrackSummaryStat
                    label="Payment pending"
                    amount={summaryStats.workflowTotals.paymentPending.amount}
                    count={summaryStats.workflowTotals.paymentPending.count}
                    tone="gold"
                  />
                  <TrackSummaryStat
                    label="Paid / verified"
                    amount={summaryStats.workflowTotals.paidVerified.amount}
                    count={summaryStats.workflowTotals.paidVerified.count}
                    tone="brand"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A7FA5]">
              Results ({total})
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
                  {sharing ? "Preparing…" : "Share Summary"}
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
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#B8CDE3] bg-white py-12 text-center text-sm text-[#5A7FA5]">
              No entries found.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const isExpanded = expandedId === entry._id;
                const canModify = canUserModifyEntry(entry);
                const needsOnSiteApproval =
                  entry.type === "expense" && entry.approvalStatus === "pending";
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
                        <p className="truncate font-semibold text-[#0B4A8C]">{entry.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#5A7FA5]">
                          {formatDate(entry.date)}
                          {entry.category ? ` · ${entry.category}` : ""}
                          {` · ${entry.method}`}
                        </p>
                        {entry.approvedBy && (
                          <p className="mt-0.5 truncate text-[10px] text-[#7A9BB8]">
                            Approved: {entry.approvedBy}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <PaymentStatusBadge entry={entry} />
                          <SyncStatusBadge status={resolveSyncStatus(entry)} compact />
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold tabular-nums text-[#0B4A8C]">
                            {formatAmount(entry.amount)}
                          </p>
                          {!canModify && (
                            <span className="text-amber-700" aria-label="Entry locked" title="Locked">
                              <LockIcon className="h-4 w-4" />
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
                              onClick={() => handleDelete(entry)}
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
                          <Row label="Amount" value={formatAmount(entry.amount)} />
                          <Row label="Payment" value={entry.method} />
                          <Row label="Requested by" value={entry.name} />
                          {entry.approvedBy && <Row label="Approved by" value={entry.approvedBy} />}
                          {entry.note && <Row label="Notes" value={entry.note} />}
                          <PaymentStatusDetail entry={entry} />
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
        </section>

        {approvingEntry && (
          <ApproveOnSiteSheet
            entry={approvingEntry}
            onClose={() => setApprovingEntry(null)}
            onSuccess={() => fetchEntries(page, appliedFilters)}
            onEditDetails={() => {
              setEditingEntry(approvingEntry);
              setApprovingEntry(null);
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
              fetchEntries(page, appliedFilters);
            }}
          />
        )}
      </div>
    </div>
  );
}

function TrackSummaryStat({
  label,
  amount,
  count,
  tone,
}: {
  label: string;
  amount: number;
  count: number;
  tone: "slate" | "gold" | "brand";
}) {
  const amountColor =
    tone === "gold" ? "text-[#7A5E10]" : tone === "brand" ? "text-[var(--brand)]" : "text-slate-700";

  return (
    <div className="px-2 py-3 text-center">
      <p className="text-[9px] font-semibold leading-tight text-[var(--text-faint)]">{label}</p>
      <p className={`mt-1 text-sm font-bold tabular-nums ${amountColor}`}>
        {formatSummaryCurrency(amount)}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">{count} entr{count === 1 ? "y" : "ies"}</p>
    </div>
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

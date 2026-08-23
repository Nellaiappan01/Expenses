"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { APP_NAME } from "@/lib/brandAssets";
import {
  buildTrackWhatsAppSummary,
  shareTrackSummaryOnWhatsApp,
  type TrackSummaryFilters,
} from "@/lib/trackWhatsAppSummary";
import { useConfig } from "../context/ConfigContext";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import type { Entry } from "@/lib/types";

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
  method: string;
  tag: string;
  search: string;
};

const EMPTY_FILTERS: Filters = {
  from: "",
  to: "",
  category: "",
  requestedBy: "",
  approvedBy: "",
  method: "",
  tag: "",
  search: "",
};

function filtersToParams(activeFilters: Filters) {
  const params = new URLSearchParams();
  if (activeFilters.from) params.set("from", activeFilters.from);
  if (activeFilters.to) params.set("to", activeFilters.to);
  if (activeFilters.category) params.set("category", activeFilters.category);
  if (activeFilters.requestedBy) params.set("requestedBy", activeFilters.requestedBy);
  if (activeFilters.approvedBy) params.set("approvedBy", activeFilters.approvedBy);
  if (activeFilters.method) params.set("method", activeFilters.method);
  if (activeFilters.tag) params.set("tag", activeFilters.tag);
  if (activeFilters.search) params.set("search", activeFilters.search);
  return params;
}

function toSummaryFilters(activeFilters: Filters): TrackSummaryFilters {
  return {
    from: activeFilters.from,
    to: activeFilters.to,
    requestedBy: activeFilters.requestedBy,
    category: activeFilters.category,
    approvedBy: activeFilters.approvedBy,
    method: activeFilters.method,
    tag: activeFilters.tag,
    search: activeFilters.search,
  };
}

export default function TrackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [tagOptions, setTagOptions] = useState<string[]>([]);

  const urlFrom = searchParams.get("from") ?? "";
  const urlTo = searchParams.get("to") ?? "";
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    from: urlFrom,
    to: urlTo,
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    from: urlFrom,
    to: urlTo,
  });
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (urlFrom || urlTo) {
      setFilters((f) => ({ ...f, from: urlFrom, to: urlTo }));
    }
  }, [urlFrom, urlTo]);

  const loadDefaults = useCallback(async () => {
    const res = await apiFetch("/api/defaults");
    if (!res.ok) return;
    const data = await res.json();
    setCategoryOptions(data.expenseCategories ?? []);
    setRequestedByOptions(data.expenseNames ?? []);
    setApprovedByOptions(data.approverNames ?? []);
    setTagOptions(data.expenseTags ?? []);
  }, []);

  const fetchEntries = useCallback(
    async (pageNum: number, activeFilters: Filters) => {
      setLoading(true);
      try {
        const params = filtersToParams(activeFilters);
        params.set("page", String(pageNum));
        params.set("limit", "15");

        const res = await apiFetch(`/api/track/entries?${params}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries);
          setHasMore(data.hasMore);
          setTotal(data.total);
          setPage(data.page);
          setAppliedFilters(activeFilters);
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
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasLedger = features.expenses || features.workers;
    if (config && !hasLedger) {
      router.replace(features.stock ? "/stock" : "/");
    }
  }, [config, router]);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults]);

  useEffect(() => {
    fetchEntries(1, filters);
  }, [fetchEntries, filters.from, filters.to]);

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
      const params = filtersToParams(appliedFilters);
      const res = await apiFetch(`/api/track/summary?${params}`);
      if (!res.ok) throw new Error("Summary failed");
      const stats = await res.json();
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
    <div className="min-h-screen bg-[#F4F8FC] pb-12">
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

        <div className="mb-4 rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
          <FieldLabel>Search anything</FieldLabel>
          <div className="flex gap-2">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Name, category, amount, note, tag, payment…"
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
            Searches all fields: requested by, approved by, category, amount, notes, tags, payment type
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Payment type</FieldLabel>
                <select
                  value={filters.method}
                  onChange={(e) => handleFilterChange("method", e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank A/c</option>
                </select>
              </div>
              <div>
                <FieldLabel>Tag</FieldLabel>
                <select
                  value={filters.tag}
                  onChange={(e) => handleFilterChange("tag", e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">All tags</option>
                  {tagOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
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
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="font-bold tabular-nums text-[#0B4A8C]">
                          {formatAmount(entry.amount)}
                        </p>
                        <svg
                          className={`h-4 w-4 text-[#7A9BB8] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#D6E6F5] bg-[#F8FBFE] px-4 py-3">
                        <dl className="space-y-2 text-sm">
                          <Row label="Date" value={formatDate(entry.date)} />
                          {entry.category && <Row label="Category" value={entry.category} />}
                          <Row label="Amount" value={formatAmount(entry.amount)} />
                          <Row label="Payment" value={entry.method} />
                          <Row label="Requested by" value={entry.name} />
                          {entry.approvedBy && <Row label="Approved by" value={entry.approvedBy} />}
                          {entry.note && <Row label="Notes" value={entry.note} />}
                          {entry.tags?.length ? (
                            <Row label="Tags" value={entry.tags.join(", ")} />
                          ) : null}
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
      </div>
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

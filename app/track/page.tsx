"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";
import type { Entry } from "@/lib/types";

interface NameWithTotal {
  name: string;
  nameLower: string;
}

function formatDate(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function TrackPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [entries, setEntries] = useState<Entry[]>([]);
  const [names, setNames] = useState<NameWithTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    name: "",
    method: "",
    type: "",
    search: "",
  });

  const fetchNames = useCallback(async () => {
    try {
      const res = await apiFetch("/api/worker-history/names");
      if (res.ok) {
        const data = await res.json();
        setNames(data);
      }
    } catch (err) {
      console.error("Failed to fetch names:", err);
    }
  }, []);

  const fetchEntries = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(pageNum));
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        if (filters.name) params.set("name", filters.name);
        if (filters.method) params.set("method", filters.method);
        if (filters.type) params.set("type", filters.type);
        if (filters.search) params.set("search", filters.search);

        const res = await apiFetch(`/api/track/entries?${params}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries);
          setHasMore(data.hasMore);
          setTotal(data.total);
          setPage(data.page);
        }
      } catch (err) {
        console.error("Failed to fetch entries:", err);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasLedger = features.expenses || features.workers;
    if (config && !hasLedger) {
      router.replace(features.stock ? "/stock" : "/");
    }
  }, [config, router]);

  useEffect(() => {
    fetchNames();
  }, [fetchNames]);

  useEffect(() => {
    fetchEntries(1);
  }, [fetchEntries]);

  function handleFilterChange(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function applyFilters() {
    fetchEntries(1);
  }

  function nextPage() {
    if (hasMore) fetchEntries(page + 1);
  }

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers) return null;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-6 pb-12 sm:px-5">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Back"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Track All
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Filter and search all entries
            </p>
          </div>
        </header>

        <div className="mb-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Filters
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                From
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => handleFilterChange("from", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                To
              </label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => handleFilterChange("to", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              Search (name or note)
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Name
              </label>
              <select
                value={filters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All</option>
                {names.map((n) => (
                  <option key={n.nameLower} value={n.nameLower}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Method
              </label>
              <select
                value={filters.method}
                onChange={(e) => handleFilterChange("method", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All</option>
                <option value="Cash">Cash</option>
                <option value="GPay">GPay</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange("type", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">All</option>
              <option value="rotation_cash">Wallet</option>
              <option value="expense">Expense</option>
              <option value="worker_payment">Worker Payment</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Apply Filters
          </button>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Results ({total})
            </h2>
            <div className="flex gap-2">
              {page > 1 && (
                <button
                  type="button"
                  onClick={() => fetchEntries(page - 1)}
                  disabled={loading}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
                >
                  ← Prev
                </button>
              )}
              {hasMore && (
                <button
                  type="button"
                  onClick={nextPage}
                  disabled={loading}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
                >
                  Next →
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              No entries found.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const isExpanded = expandedId === entry._id;
                return (
                  <div
                    key={entry._id}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : entry._id ?? null)
                      }
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {entry.name}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDate(entry.date)} · {entry.method} ·{" "}
                          {entry.type === "rotation_cash" ? "Wallet" : entry.type.replace("_", " ")}
                        </p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <p
                          className={`font-semibold tabular-nums ${
                            entry.amount >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatAmount(entry.amount)}
                        </p>
                        <svg
                          className={`h-5 w-5 text-zinc-400 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              Type
                            </dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                              {entry.type === "rotation_cash" ? "Wallet" : entry.type.replace("_", " ")}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              Date
                            </dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                              {formatDate(entry.date)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              Method
                            </dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                              {entry.method}
                            </dd>
                          </div>
                          {entry.bankName && (
                            <div className="flex justify-between">
                              <dt className="text-zinc-500 dark:text-zinc-400">Bank</dt>
                              <dd className="text-zinc-900 dark:text-zinc-100">{entry.bankName}</dd>
                            </div>
                          )}
                          {entry.sender && (
                            <div className="flex justify-between">
                              <dt className="text-zinc-500 dark:text-zinc-400">From</dt>
                              <dd className="text-zinc-900 dark:text-zinc-100">{entry.sender}</dd>
                            </div>
                          )}
                          {entry.note && (
                            <div>
                              <dt className="text-zinc-500 dark:text-zinc-400">
                                Note
                              </dt>
                              <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">
                                {entry.note}
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

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import type { Entry } from "@/lib/types";
import EditEntrySheet, { EditIcon, TrashIcon } from "../components/EditEntrySheet";

interface NameWithTotal {
  name: string;
  nameLower: string;
  total: number;
  count: number;
}

function formatDate(isoDate: string) {
  return formatDateDDMMYYYY(isoDate);
}

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

type FilterType = "expense" | "worker_payment" | "adjustment" | "all";

export default function WorkerHistoryPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [names, setNames] = useState<NameWithTotal[]>([]);

  useEffect(() => {
    if (config && !config.features?.workers) {
      router.replace("/");
    }
  }, [config, router]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingNames, setLoadingNames] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedNameLower, setSelectedNameLower] = useState<string | null>(null);
  const [selectedDisplayName, setSelectedDisplayName] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [bankOptions, setBankOptions] = useState<string[]>([]);

  const fetchNames = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("type", filter);
      const res = await apiFetch(`/api/worker-history/names?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNames(data);
      }
    } catch (err) {
      console.error("Failed to fetch names:", err);
    } finally {
      setLoadingNames(false);
    }
  }, [filter]);

  const fetchEntries = useCallback(async (nameLower: string) => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams({ nameLower });
      if (filter !== "all") params.set("type", filter);
      const res = await apiFetch(`/api/worker-history/entries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setLoadingEntries(false);
    }
  }, [filter]);

  useEffect(() => {
    apiFetch("/api/defaults")
      .then((r) => (r.ok ? r.json() : { banks: [] }))
      .then((d) => setBankOptions(d.banks ?? []));
  }, []);

  useEffect(() => {
    setLoadingNames(true);
    fetchNames();
  }, [fetchNames]);

  useEffect(() => {
    if (selectedNameLower) {
      fetchEntries(selectedNameLower);
    }
  }, [filter, selectedNameLower, fetchEntries]);

  useEffect(() => {
    if (names.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const nameLower = params.get("name");
    if (nameLower) {
      setSelectedNameLower(nameLower);
      const match = names.find((n) => n.nameLower === nameLower);
      setSelectedDisplayName(match?.name ?? nameLower);
      fetchEntries(nameLower);
    }
  }, [names, fetchEntries]);

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const nameLower = params.get("name");
      if (nameLower) {
        setSelectedNameLower(nameLower);
        const match = names.find((n) => n.nameLower === nameLower);
        setSelectedDisplayName(match?.name ?? nameLower);
        fetchEntries(nameLower);
      } else {
        setSelectedNameLower(null);
        setSelectedDisplayName(null);
        setEntries([]);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [names, fetchEntries]);

  function handleSelectName(item: NameWithTotal) {
    const url = new URL(window.location.href);
    url.searchParams.set("name", item.nameLower);
    window.history.pushState({}, "", url.toString());
    setSelectedNameLower(item.nameLower);
    setSelectedDisplayName(item.name);
    fetchEntries(item.nameLower);
  }

  function handleBack() {
    const url = new URL(window.location.href);
    url.searchParams.delete("name");
    window.history.pushState({}, "", url.toString());
    setSelectedNameLower(null);
    setSelectedDisplayName(null);
    setEntries([]);
  }

  async function handleDelete(entry: Entry, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this entry?")) return;
    try {
      const res = await apiFetch(`/api/entries/${entry._id}`, { method: "DELETE" });
      if (res.ok && selectedNameLower) {
        setEntries((prev) => prev.filter((e) => e._id !== entry._id));
        fetchNames();
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  const totalForSelected = selectedNameLower
    ? names.find((n) => n.nameLower === selectedNameLower)?.total ?? 0
    : 0;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-6 pb-12 sm:px-5">
        <header className="mb-6 flex items-center gap-3">
          {selectedNameLower ? (
            <button
              onClick={handleBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              aria-label="Back to list"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          ) : (
            <Link
              href="/"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              aria-label="Back to ledger"
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
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {selectedNameLower ? selectedDisplayName : "Worker History"}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {selectedNameLower
                ? "Transaction history"
                : "Grouped by name · Click for details"}
            </p>
          </div>
        </header>

        <div className="mb-4 flex gap-2">
          {(["all", "expense", "worker_payment", "adjustment"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                filter === f
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {f === "all" ? "All" : f === "expense" ? "Expenses" : f === "worker_payment" ? "Workers" : "Adj"}
            </button>
          ))}
        </div>

        {selectedNameLower ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Total
              </p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  totalForSelected >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatAmount(totalForSelected)}
              </p>
            </div>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Transactions
              </h2>
              {loadingEntries ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </div>
              ) : entries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                  No transactions found.
                </p>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry._id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatDate(entry.date)}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {entry.method}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 font-semibold tabular-nums ${
                          entry.amount >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatAmount(entry.amount)}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntry(entry);
                          }}
                          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          aria-label="Edit"
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(entry, e)}
                          className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                          aria-label="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            {loadingNames ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : names.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No entries yet.
                </p>
                <Link
                  href="/"
                  className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  Add your first entry →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {names.map((item) => (
                  <button
                    key={item.nameLower}
                    onClick={() => handleSelectName(item)}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.count} transaction{item.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p
                      className={`ml-3 shrink-0 font-semibold tabular-nums ${
                        item.total >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatAmount(item.total)}
                    </p>
                    <svg
                      className="ml-2 h-5 w-5 shrink-0 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {editingEntry && (
          <EditEntrySheet
            entry={editingEntry}
            bankOptions={bankOptions}
            onClose={() => setEditingEntry(null)}
            onSuccess={() => {
              if (selectedNameLower) fetchEntries(selectedNameLower);
              fetchNames();
              setEditingEntry(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

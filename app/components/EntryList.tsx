"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Entry } from "@/lib/types";
import EditEntrySheet, { EditIcon, TrashIcon } from "./EditEntrySheet";

function formatDate(isoDate: string) {
  const d = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function EntryList({
  refreshTrigger = 0,
  limit,
}: {
  refreshTrigger?: number;
  limit?: number;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMoreFromApi, setHasMoreFromApi] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [bankOptions, setBankOptions] = useState<string[]>([]);

  const fetchEntries = useCallback(async () => {
    try {
      const url = limit
        ? `/api/track/entries?page=1&limit=${limit}`
        : "/api/entries";
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = limit ? data.entries : data;
        setEntries(list);
        setHasMoreFromApi(!!(limit && data.hasMore));
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    apiFetch("/api/defaults")
      .then((r) => (r.ok ? r.json() : { banks: [] }))
      .then((d) => setBankOptions(d.banks ?? []));
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, refreshTrigger]);

  const hasMore = limit ? hasMoreFromApi : false;

  async function handleDelete(entry: Entry, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this entry?")) return;
    try {
      const res = await apiFetch(`/api/entries/${entry._id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e._id !== entry._id));
        setExpandedId(null);
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const key = entry.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
        <p className="text-sm">No entries yet.</p>
        <p className="mt-1 text-xs">Add your first entry above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasMore && (
        <Link
          href="/track"
          className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
        >
          Track All
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
      {sortedDates.map((dateKey) => (
        <section key={dateKey}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {formatDate(dateKey)}
          </h3>
          <div className="space-y-2">
            {grouped[dateKey].map((entry) => {
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
                        {entry.method}
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
                      <div className="mb-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntry(entry);
                          }}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          aria-label="Edit"
                        >
                          <EditIcon />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(entry, e)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                          aria-label="Delete"
                        >
                          <TrashIcon />
                          Delete
                        </button>
                      </div>
                      <dl className="space-y-1 text-sm">
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
                            {new Date(entry.date).toLocaleDateString("en-IN")}
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
        </section>
      ))}

      {editingEntry && (
        <EditEntrySheet
          entry={editingEntry}
          bankOptions={bankOptions}
          onClose={() => setEditingEntry(null)}
          onSuccess={() => {
            fetchEntries();
            setEditingEntry(null);
          }}
        />
      )}
    </div>
  );
}
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { cachedApiJson, cacheKey, notifyLedgerDataChanged, readClientCache } from "@/lib/clientDataCache";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { entryAmountColorClass, formatEntryAmount } from "@/lib/entryDisplay";
import type { Entry } from "@/lib/types";
import { canUserModifyEntry, entryLockShortLabel } from "@/lib/paymentWorkflow";
import { PaymentStatusBadge, PaymentStatusDetail } from "./payments/PaymentStatus";
import ApproveOnSiteSheet from "./payments/ApproveOnSiteSheet";
import EditEntrySheet, { EditIcon, TrashIcon } from "./EditEntrySheet";
import { useUser } from "../context/UserContext";

function formatDate(isoDate: string) {
  return formatDateDDMMYYYY(isoDate);
}

export default function EntryList({
  refreshTrigger = 0,
  limit,
  todayOnly = false,
  readOnly = false,
  onRefresh,
}: {
  refreshTrigger?: number;
  limit?: number;
  todayOnly?: boolean;
  readOnly?: boolean;
  onRefresh?: () => void;
}) {
  const { userName, userId } = useUser();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMoreFromApi, setHasMoreFromApi] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [approvingEntry, setApprovingEntry] = useState<Entry | null>(null);
  const [bankOptions, setBankOptions] = useState<string[]>([]);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    try {
      let url: string;
      if (limit) {
        const params = new URLSearchParams({ page: "1", limit: String(limit) });
        if (todayOnly) {
          const today = new Date().toISOString().split("T")[0];
          params.set("from", today);
          params.set("to", today);
        }
        url = `/api/track/entries?${params}`;
      } else {
        url = "/api/entries";
      }

      const hasCache = readClientCache<Entry[] | { entries: Entry[] }>(cacheKey(url)) !== null;
      if (!hasCache) {
        setEntries([]);
        setLoading(true);
      }

      const { data } = await cachedApiJson<Entry[] | { entries: Entry[]; hasMore?: boolean }>(
        url,
        30_000
      );
      if (data) {
        const list = limit && !Array.isArray(data) ? data.entries : (data as Entry[]);
        setEntries(list);
        if (limit && !Array.isArray(data)) {
          setHasMoreFromApi(!!data.hasMore);
        }
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [limit, todayOnly, userId]);

  useEffect(() => {
    apiFetch("/api/defaults")
      .then((r) => (r.ok ? r.json() : { banks: [] }))
      .then((d) => setBankOptions(d.banks ?? []));
  }, [userId]);

  useEffect(() => {
    setEntries([]);
    fetchEntries();
  }, [fetchEntries, refreshTrigger, userId]);

  const hasMore = limit ? hasMoreFromApi : false;

  async function handleDelete(entry: Entry, e: React.MouseEvent) {
    e.stopPropagation();
    const reason = prompt("Reason for deletion (required):");
    if (!reason?.trim()) return;
    if (!confirm("Delete this entry?")) return;
    try {
      const res = await apiFetch(`/api/entries/${entry._id}/adjust`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), editedBy: userName || "User" }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e._id !== entry._id));
        setExpandedId(null);
        notifyLedgerDataChanged();
        onRefresh?.();
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
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 py-10 text-center text-[var(--text-muted)] shadow-sm">
        <p className="text-sm">{todayOnly ? "No entries for today." : "No entries yet."}</p>
        <p className="mt-1 text-xs text-[#9BB5CC]">
          {todayOnly ? "Add an entry above or view all in Track." : "Add your first entry above."}
        </p>
        {todayOnly && (
          <Link
            href="/track"
            className="mt-3 inline-block text-sm font-semibold text-[#0B4A8C]"
          >
            View all entries →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(hasMore || todayOnly) && (
        <Link
          href="/track"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-[var(--brand)] shadow-sm ring-1 ring-[var(--border-soft)] active:bg-slate-50"
        >
          {todayOnly ? "View all entries" : "Track All"}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
      {sortedDates.map((dateKey) => (
        <section key={dateKey}>
          <h3 className="mb-2 px-0.5 text-xs font-semibold text-[var(--text-faint)]">
            {formatDate(dateKey)}
          </h3>
          <div className="space-y-2.5">
            {grouped[dateKey].map((entry) => {
              const isExpanded = expandedId === entry._id;
              const canModify = canUserModifyEntry(entry);
              const needsOnSiteApproval =
                entry.type === "expense" && entry.approvalStatus === "pending";
              return (
                <div
                  key={entry._id}
                  className="ui-card overflow-hidden transition-shadow active:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entry._id ?? null)
                    }
                    className="flex w-full min-h-[56px] items-center justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {entry.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {entry.category ? `${entry.category} · ` : ""}
                        {entry.method}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <PaymentStatusBadge entry={entry} />
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-bold tabular-nums ${entryAmountColorClass(entry)}`}
                        >
                          {formatEntryAmount(entry.amount, entry.type)}
                        </p>
                        {!readOnly && !canModify && (
                          <span className="max-w-[7.5rem] text-right text-[10px] font-semibold leading-tight text-amber-800">
                            {entryLockShortLabel(entry)}
                          </span>
                        )}
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
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                      {!readOnly && canModify && (
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleDelete(entry, e)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                            aria-label="Delete"
                          >
                            <TrashIcon />
                          </button>
                          {needsOnSiteApproval ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setApprovingEntry(entry);
                              }}
                              className="flex items-center gap-1.5 rounded-xl bg-[#0B4A8C] px-4 py-2.5 text-sm font-semibold text-white"
                            >
                              Set approved by
                            </button>
                          ) : (
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
                          )}
                        </div>
                      )}
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
                            {formatDateDDMMYYYY(entry.date)}
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
                          <div className="flex justify-between gap-4">
                            <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">
                              Note
                            </dt>
                            <dd className="text-right text-zinc-900 dark:text-zinc-100">
                              {entry.note}
                            </dd>
                          </div>
                        )}
                      </dl>
                      <PaymentStatusDetail entry={entry} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {approvingEntry && (
        <ApproveOnSiteSheet
          entry={approvingEntry}
          onClose={() => setApprovingEntry(null)}
          onSuccess={() => {
            fetchEntries();
            onRefresh?.();
          }}
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
            fetchEntries();
            setEditingEntry(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
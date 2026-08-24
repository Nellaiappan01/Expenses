"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { syncEverything } from "@/lib/clientSync";
import { LEDGER_DATA_CHANGED } from "@/lib/clientDataCache";
import { getOfflineQueueCount } from "@/lib/offlineEntryQueue";

export default function SheetsSyncBanner({
  refreshTrigger = 0,
  onRefresh,
}: {
  refreshTrigger?: number;
  onRefresh?: () => void;
}) {
  const [counts, setCounts] = useState({ pending: 0, failed: 0, total: 0 });
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    setOfflineCount(getOfflineQueueCount());
    try {
      const res = await apiFetch("/api/sheets/status");
      if (res.ok) {
        setCounts(await res.json());
      }
    } catch {
      /* server unreachable */
    }
  }, []);

  const runSyncAll = useCallback(
    async (silent = false) => {
      if (syncingRef.current) return;
      const offline = getOfflineQueueCount();
      if (offline === 0 && counts.total === 0) return;
      if (!navigator.onLine) return;

      syncingRef.current = true;
      setSyncing(true);
      if (!silent) setMessage("");

      try {
        const result = await syncEverything();
        setMessage(result.message);
        if (result.counts) setCounts(result.counts);
        setOfflineCount(getOfflineQueueCount());
        onRefresh?.();
      } catch {
        if (!silent) setMessage("Sync failed. Try again.");
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        await refreshCounts();
      }
    },
    [counts.total, onRefresh, refreshCounts]
  );

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, refreshTrigger]);

  useEffect(() => {
    if (counts.total === 0 && !syncing) return;
    const timer = window.setInterval(() => {
      void refreshCounts();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [counts.total, syncing, refreshCounts]);

  useEffect(() => {
    const onQueue = () => setOfflineCount(getOfflineQueueCount());
    const onSync = () => {
      void refreshCounts();
      onRefresh?.();
    };
    window.addEventListener("offline-queue-updated", onQueue);
    window.addEventListener("sync-all-complete", onSync);
    window.addEventListener(LEDGER_DATA_CHANGED, onSync);
    return () => {
      window.removeEventListener("offline-queue-updated", onQueue);
      window.removeEventListener("sync-all-complete", onSync);
      window.removeEventListener(LEDGER_DATA_CHANGED, onSync);
    };
  }, [refreshCounts, onRefresh]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    const onOnline = () => {
      updateOnline();
      void runSyncAll(true);
    };
    updateOnline();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [runSyncAll]);

  const grandTotal = offlineCount + counts.total;
  const showBanner = grandTotal > 0 || message || !isOnline;

  if (!showBanner) return null;

  return (
    <div
      className={`rounded-xl px-3 py-2.5 ring-1 ${
        !isOnline
          ? "bg-slate-100 ring-slate-200"
          : counts.failed > 0
            ? "bg-red-50 ring-red-200/80"
            : "bg-amber-50 ring-amber-200/80"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          {!isOnline && (
            <p className="font-medium text-slate-800">
              You&apos;re offline — entries save on this device.
            </p>
          )}
          {grandTotal > 0 && (
            <p className={!isOnline ? "mt-0.5 text-xs text-slate-600" : "text-amber-900"}>
              {syncing && (
                <span className="mr-1 font-semibold">
                  Syncing… {Math.max(0, counts.total)} left
                </span>
              )}
              {!syncing && counts.total > 0 && (
                <span className="mr-1 font-semibold">
                  Sheet progress: {counts.pending + counts.failed} left
                </span>
              )}
              {offlineCount > 0 && (
                <span>
                  <strong>{offlineCount}</strong> saved offline
                  {counts.total > 0 ? " · " : ""}
                </span>
              )}
              {counts.pending > 0 && (
                <Link
                  href="/track?sheetsSync=pending"
                  className="font-bold underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
                >
                  {counts.pending} sheet pending
                </Link>
              )}
              {counts.pending > 0 && counts.failed > 0 && ", "}
              {counts.failed > 0 && (
                <Link
                  href="/track?sheetsSync=failed"
                  className="font-bold text-red-700 underline decoration-red-300 underline-offset-2 hover:text-red-900"
                >
                  {counts.failed} sheet failed
                </Link>
              )}
            </p>
          )}
          {message && <p className="mt-0.5 text-xs text-emerald-800">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => runSyncAll(false)}
          disabled={syncing || !isOnline}
          className="shrink-0 rounded-lg bg-[#0B4A8C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#083A6E] disabled:opacity-50"
        >
          {syncing ? `Syncing… ${counts.total} left` : "Sync All"}
        </button>
      </div>
    </div>
  );
}

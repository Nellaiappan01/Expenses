"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { syncEverything } from "@/lib/clientSync";
import { LEDGER_DATA_CHANGED } from "@/lib/clientDataCache";
import { getOfflineQueueCount } from "@/lib/offlineEntryQueue";
import { sheetsEtaLabel } from "@/lib/sheetsSyncCopy";

function etaLabel(rows: number): string {
  return sheetsEtaLabel(rows);
}

export default function SheetsSyncBanner({
  refreshTrigger = 0,
  onRefresh,
}: {
  refreshTrigger?: number;
  onRefresh?: () => void;
}) {
  const [counts, setCounts] = useState({ pending: 0, failed: 0, total: 0, removing: 0 });
  const [failureHints, setFailureHints] = useState<string[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);
  const startTotalRef = useRef(0);

  const refreshCounts = useCallback(async () => {
    setOfflineCount(getOfflineQueueCount());
    try {
      const res = await apiFetch("/api/sheets/status");
      if (res.ok) {
        const data = await res.json();
        setCounts({
          pending: data.pending ?? 0,
          failed: data.failed ?? 0,
          total: data.total ?? 0,
          removing: data.removing ?? 0,
        });
        setFailureHints(Array.isArray(data.failures) ? data.failures : []);
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
      startTotalRef.current = Math.max(counts.total + offline, 1);
      setSyncing(true);
      setErrorMessage("");

      try {
        const result = await syncEverything();
        if (result.ok) {
          setCounts({ pending: 0, failed: 0, total: 0, removing: 0 });
          setErrorMessage("");
        } else if (result.counts) {
          setCounts({
            pending: result.counts.pending ?? 0,
            failed: result.counts.failed ?? 0,
            total: result.counts.total ?? 0,
            removing: result.counts.removing ?? 0,
          });
          if (result.counts.total > 0) {
            setErrorMessage("Some rows did not sync. Tap Sync All to retry.");
          }
        }
        setOfflineCount(getOfflineQueueCount());
        onRefresh?.();
      } catch {
        if (!silent) setErrorMessage("Sync failed. Try again.");
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
  const showBanner = grandTotal > 0 || syncing || !isOnline;
  const remaining = grandTotal;
  const started = Math.max(startTotalRef.current, remaining);
  const done = syncing ? Math.max(0, started - remaining) : 0;
  const eta = etaLabel(remaining);

  if (!showBanner) return null;

  return (
    <div
      className={`rounded-2xl px-3 py-3 ring-1 ${
        !isOnline
          ? "bg-slate-100 ring-slate-200"
          : counts.failed > 0
            ? "bg-red-50 ring-red-200/80"
            : "bg-amber-50 ring-amber-200/80"
      }`}
    >
      {!isOnline ? (
        <p className="text-sm font-semibold text-slate-800">Offline — entries save on this phone.</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0B4A8C]">
                {syncing ? "Writing to Google Sheet" : "Google Sheet"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold tabular-nums text-[#5A7FA5]">
                {syncing ? (
                  remaining > 0 ? (
                    <>
                      <span>{done} done</span>
                      <span>{remaining} left</span>
                      <span className="text-[#0B4A8C]">{eta}</span>
                    </>
                  ) : (
                    "Finishing…"
                  )
                ) : remaining > 0 ? (
                  <>
                    <span>
                      {remaining} {remaining === 1 ? "row" : "rows"}
                    </span>
                    <span className="text-[#0B4A8C]">{eta}</span>
                  </>
                ) : (
                  "Up to date"
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runSyncAll(false)}
              disabled={syncing || !isOnline || remaining === 0}
              className="shrink-0 rounded-xl bg-[#0B4A8C] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync All"}
            </button>
          </div>

          {grandTotal > 0 ? (
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <Link
                href="/track?sheetsSync=pending"
                className="rounded-xl bg-white/80 px-2 py-2 text-center ring-1 ring-[#D6E6F5]"
              >
                <p className="text-lg font-extrabold tabular-nums text-[#0B4A8C]">{counts.pending}</p>
                <p className="text-[10px] font-semibold text-[#7A9BB8]">Waiting</p>
              </Link>
              <Link
                href="/track?sheetsSync=failed"
                className="rounded-xl bg-white/80 px-2 py-2 text-center ring-1 ring-[#D6E6F5]"
              >
                <p className="text-lg font-extrabold tabular-nums text-red-700">{counts.failed}</p>
                <p className="text-[10px] font-semibold text-[#7A9BB8]">Failed</p>
              </Link>
              <div className="rounded-xl bg-white/80 px-2 py-2 text-center ring-1 ring-[#D6E6F5]">
                <p className="text-lg font-extrabold tabular-nums text-[#0B4A8C]">{eta || "—"}</p>
                <p className="text-[10px] font-semibold text-[#7A9BB8]">Time</p>
              </div>
            </div>
          ) : null}
          {offlineCount > 0 ? (
            <p className="mt-1.5 text-[11px] font-medium text-[#5A7FA5]">{offlineCount} saved on this phone</p>
          ) : null}

          {syncing && started > 0 ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-[#0B4A8C] transition-[width]"
                style={{ width: `${Math.min(100, Math.round((done / started) * 100))}%` }}
              />
            </div>
          ) : null}

          {counts.removing > 0 && !syncing ? (
            <p className="mt-2 text-xs font-medium leading-relaxed text-[#0B4A8C]">
              {counts.removing === 1 ? "1 deleted entry" : `${counts.removing} deleted entries`} still on
              the Google Sheet. Tap Sync All to remove {counts.removing === 1 ? "it" : "them"}.
            </p>
          ) : null}
          {errorMessage && remaining > 0 && !syncing ? (
            <p className="mt-2 text-xs font-medium text-red-800">{errorMessage}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

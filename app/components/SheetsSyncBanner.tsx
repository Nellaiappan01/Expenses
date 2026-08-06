"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function SheetsSyncBanner({
  refreshTrigger = 0,
  onRefresh,
}: {
  refreshTrigger?: number;
  onRefresh?: () => void;
}) {
  const [counts, setCounts] = useState({ pending: 0, failed: 0, total: 0 });
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState("");

  const fetchCounts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/sheets/status");
      if (res.ok) {
        setCounts(await res.json());
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, refreshTrigger]);

  async function retryAll() {
    setRetrying(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/sheets/retry-all", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage(`All ${data.succeeded} entries synced successfully.`);
      } else if (data.succeeded > 0) {
        setMessage(`${data.succeeded} synced, ${data.failed} still failed.`);
      } else {
        setMessage(data.error ?? "Retry failed. Check server logs.");
      }
      setCounts(data.counts ?? counts);
      onRefresh?.();
    } catch {
      setMessage("Retry failed. Try again.");
    } finally {
      setRetrying(false);
      fetchCounts();
    }
  }

  if (counts.total === 0 && !message) return null;

  return (
    <div className="rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-amber-900">
          {counts.total > 0 && (
            <span>
              Sheets sync:{" "}
              {counts.pending > 0 && (
                <strong>{counts.pending} pending</strong>
              )}
              {counts.pending > 0 && counts.failed > 0 && ", "}
              {counts.failed > 0 && (
                <strong className="text-red-700">{counts.failed} failed</strong>
              )}
            </span>
          )}
          {message && <p className="mt-0.5 text-xs">{message}</p>}
        </div>
        {counts.failed > 0 && (
          <button
            type="button"
            onClick={retryAll}
            disabled={retrying}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {retrying ? "Retrying…" : "Retry All Failed"}
          </button>
        )}
      </div>
    </div>
  );
}

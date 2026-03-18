"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function NetAmountCard({
  refreshTrigger = 0,
}: {
  refreshTrigger?: number;
}) {
  const [net, setNet] = useState<number | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiFetch("/api/dashboard/summary");
      if (res.ok) {
        const data = await res.json();
        setNet(data.net ?? 0);
      }
    } catch {
      setNet(0);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshTrigger]);

  if (net === null) return null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-sm ${
        net >= 0
          ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30"
          : "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          net >= 0
            ? "text-emerald-600/80 dark:text-emerald-400/80"
            : "text-red-600/80 dark:text-red-400/80"
        }`}
      >
        Net
      </p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          net >= 0
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-red-700 dark:text-red-300"
        }`}
      >
        {formatAmount(net)}
      </p>
    </div>
  );
}

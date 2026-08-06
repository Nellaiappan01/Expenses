"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

  if (net === null) {
    return (
      <div className="h-16 animate-pulse rounded-xl bg-white/60" aria-hidden />
    );
  }

  const positive = net >= 0;

  return (
    <div
      className={`net-card-enter flex items-baseline justify-between rounded-xl px-4 py-2.5 ${
        positive ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-widest opacity-80">
        Net
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-tight">
        {formatAmount(net)}
      </span>
    </div>
  );
}

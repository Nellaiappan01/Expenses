"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Summary {
  rotationCash: number;
  expense: number;
  workerPayment: number;
  adjustment: number;
  net: number;
}

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function SummaryCard({
  label,
  value,
  variant = "default",
  className = "",
}: {
  label: string;
  value: number;
  variant?: "rotation" | "expense" | "payment" | "adjustment" | "net" | "default";
  className?: string;
}) {
  const colors =
    variant === "rotation"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "expense"
        ? "text-red-600 dark:text-red-400"
        : variant === "payment"
        ? "text-amber-600 dark:text-amber-400"
        : variant === "adjustment"
          ? "text-blue-600 dark:text-blue-400"
          : variant === "net"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className={`rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${colors}`}>
        {formatAmount(value)}
      </p>
    </div>
  );
}

export default function DashboardSummary({
  refreshTrigger = 0,
}: {
  refreshTrigger?: number;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await apiFetch(`/api/dashboard/summary?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        setSummary({ rotationCash: 0, expense: 0, workerPayment: 0, adjustment: 0, net: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
      setSummary({ rotationCash: 0, expense: 0, workerPayment: 0, adjustment: 0, net: 0 });
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    setLoading(true);
    fetchSummary();
  }, [fetchSummary, refreshTrigger]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  const data = summary ?? {
    rotationCash: 0,
    expense: 0,
    workerPayment: 0,
    adjustment: 0,
    net: 0,
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard label="Received" value={data.rotationCash} variant="rotation" />
        <SummaryCard label="Expenses" value={data.expense + data.workerPayment} variant="expense" />
        <SummaryCard label="Net" value={data.net} variant="net" className="col-span-2" />
      </div>
    </div>
  );
}

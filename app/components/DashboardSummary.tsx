"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Summary {
  income: number;
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
  variant?: "income" | "expense" | "payment" | "adjustment" | "net" | "default";
  className?: string;
}) {
  const colors =
    variant === "income"
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

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiFetch("/api/dashboard/summary");
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        setSummary({ income: 0, expense: 0, workerPayment: 0, adjustment: 0, net: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
      setSummary({ income: 0, expense: 0, workerPayment: 0, adjustment: 0, net: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

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
    income: 0,
    expense: 0,
    workerPayment: 0,
    adjustment: 0,
    net: 0,
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <SummaryCard label="Income" value={data.income} variant="income" />
      <SummaryCard label="Expense" value={data.expense} variant="expense" />
      <SummaryCard label="Workers" value={data.workerPayment} variant="payment" />
      <SummaryCard label="Adjust" value={data.adjustment} variant="adjustment" />
      <SummaryCard label="Net" value={data.net} variant="net" className="col-span-2" />
    </div>
  );
}

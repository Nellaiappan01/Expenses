"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { useConfig } from "@/app/context/ConfigContext";

type DashboardDay = {
  date: string;
  inCount: number;
  outCount: number;
  inValue: number;
  outValue: number;
  netCount: number;
  netValue: number;
  entries: { name: string; diff: number; value: number }[];
};

function formatDashboardDate(dateStr: string) {
  return formatDateDDMMYYYY(dateStr);
}

export default function StockDashboardPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [dashboardDays, setDashboardDays] = useState<7 | 15 | 30>(7);
  const [dashboardData, setDashboardData] = useState<DashboardDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (config && !config.features?.stock) {
      router.replace("/");
    }
  }, [config, router]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/stock/dashboard?days=${dashboardDays}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data.days ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [dashboardDays]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-4 pb-28 sm:px-5">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/stock"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Back to Stock"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Stock Dashboard
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Day-wise in/out view
            </p>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          {([7, 15, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDashboardDays(d)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                dashboardDays === d
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {d === 30 ? "Last 1 month" : `Last ${d} days`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : dashboardData.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No stock checks in the last {dashboardDays} days
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Update stock counts to see day-wise in/out here
            </p>
            <Link
              href="/stock"
              className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Go to Stock Check →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboardData.map((day) => (
              <div
                key={day.date}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDashboardDate(day.date)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 p-4 sm:gap-4">
                  <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">In</p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                      +{day.inCount}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500">
                      ₹{day.inValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">Out</p>
                    <p className="text-sm font-semibold tabular-nums text-red-800 dark:text-red-300">
                      -{day.outCount}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500">
                      ₹{day.outValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Net</p>
                    <p className={`text-sm font-semibold tabular-nums ${day.netCount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {day.netCount >= 0 ? "+" : ""}{day.netCount}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      ₹{day.netValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                {day.entries.length > 0 && (
                  <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-800">
                    <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Items</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {day.entries.map((e, i) => (
                        <div key={`${e.name}-${i}`} className="flex justify-between text-xs">
                          <span className="truncate text-zinc-700 dark:text-zinc-300">{e.name}</span>
                          <span className={`shrink-0 font-medium ${e.diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {e.diff >= 0 ? "+" : ""}{e.diff}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

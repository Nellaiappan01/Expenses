"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "@/app/context/ConfigContext";
import { toLocalDateString, addLocalDays } from "@/lib/dateFormat";
import {
  StockDashboardView,
  type DashboardDay,
  type DashboardSummary,
  type DashboardRange,
} from "../components/StockDashboardView";

function localToday(): string {
  return toLocalDateString();
}

function localDaysAgo(n: number): string {
  return toLocalDateString(addLocalDays(new Date(), -n));
}

export default function StockDashboardPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [customFrom, setCustomFrom] = useState(() => localDaysAgo(29));
  const [customTo, setCustomTo] = useState(localToday);
  const [appliedFrom, setAppliedFrom] = useState(() => localDaysAgo(29));
  const [appliedTo, setAppliedTo] = useState(localToday);
  const [dashboardData, setDashboardData] = useState<DashboardDay[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [range, setRange] = useState<DashboardRange | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (config && !config.features?.stock) {
      router.replace("/");
    }
  }, [config, router]);

  const fetchDashboard = useCallback(async () => {
    if (!appliedFrom || !appliedTo) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/stock/dashboard?from=${appliedFrom}&to=${appliedTo}`
      );
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data.days ?? []);
        setSummary(
          data.summary ?? {
            godownUnits: 0,
            periodIn: 0,
            periodOut: 0,
            netMovement: 0,
          }
        );
        setRange(data.range ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100/80 to-white pb-28">
      <div className="mx-auto max-w-md px-4 py-4">
        <header className="stock-tally-enter mb-4 flex items-center gap-3">
          <Link
            href="/stock"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 active:scale-95"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Stock report</h1>
            <p className="text-sm text-zinc-500">From – To · tap a day</p>
          </div>
        </header>

        <StockDashboardView
          days={dashboardData}
          summary={summary ?? { godownUnits: 0, periodIn: 0, periodOut: 0, netMovement: 0 }}
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onApplyCustom={applyCustom}
          loading={loading}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { EMPTY_TOTALS, formatCurrency, type TotalsBreakdown } from "@/lib/totals";
import { useConfig } from "../context/ConfigContext";

function fieldClass() {
  return "w-full rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-sm text-[#0B4A8C] outline-none transition-colors focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
}

function BreakdownRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "in" | "out" | "neutral";
}) {
  if (value === 0) return null;
  const color =
    tone === "in"
      ? "text-[#0B4A8C]"
      : tone === "out"
        ? "text-red-600"
        : "text-[#5A7FA5]";
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-[#5A7FA5]">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export default function TotalsPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [totals, setTotals] = useState<TotalsBreakdown>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);

  const fetchTotals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await apiFetch(`/api/totals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTotals({ ...EMPTY_TOTALS, ...data });
      }
    } catch (err) {
      console.error("Failed to fetch totals:", err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasLedger = features.expenses || features.workers;
    if (config && !hasLedger) {
      router.replace(features.stock ? "/stock" : "/");
    }
  }, [config, router]);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers) return null;

  const rangeLabel =
    from && to
      ? `${formatDateDDMMYYYY(from)} – ${formatDateDDMMYYYY(to)}`
      : from
        ? `From ${formatDateDDMMYYYY(from)}`
        : to
          ? `Until ${formatDateDDMMYYYY(to)}`
          : "All time";

  return (
    <div className="min-h-screen bg-[#F4F8FC]">
      <div className="mx-auto max-w-md px-4 py-6 pb-24 sm:px-5">
        <header className="mb-5 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D6E6F5] bg-white text-[#0B4A8C] shadow-sm"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0B4A8C]">Totals by Time</h1>
            <p className="text-sm text-[#5A7FA5]">Money in, money out &amp; net balance</p>
          </div>
        </header>

        <div className="mb-4 rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A7FA5]">Date range</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7A9BB8]">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass()} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7A9BB8]">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass()} />
            </div>
          </div>
          <button
            type="button"
            onClick={fetchTotals}
            disabled={loading}
            className="mt-3 w-full rounded-xl bg-[#0B4A8C] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#083A6E] disabled:opacity-60"
          >
            {loading ? "Loading…" : "Apply filter"}
          </button>
          <p className="mt-2 text-center text-[10px] text-[#7A9BB8]">{rangeLabel}</p>
        </div>

        {/* Net — highlighted */}
        <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B4A8C] to-[#083A6E] p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">Net total</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
            {loading ? "…" : formatCurrency(totals.net)}
          </p>
          <p className="mt-2 text-xs text-white/80">
            Received {formatCurrency(totals.received)} − Paid {formatCurrency(totals.paid)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF5FC] text-[#0B4A8C]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5A7FA5]">Received</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#0B4A8C]">
              {loading ? "…" : formatCurrency(totals.received)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5A7FA5]">Paid</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-red-600">
              {loading ? "…" : formatCurrency(totals.paid)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A7FA5]">Breakdown</h3>
          <div className="mt-1 divide-y divide-[#EEF5FC]">
            <BreakdownRow label="Wallet added" value={totals.walletIn} tone="in" />
            <BreakdownRow label="Wallet withdrawn" value={totals.walletOut} tone="out" />
            <BreakdownRow label="Expenses" value={totals.expense} tone="out" />
            <BreakdownRow label="Worker payments" value={totals.workerPayment} tone="out" />
            {totals.adjustment !== 0 && (
              <BreakdownRow
                label={totals.adjustment >= 0 ? "Adjustments (in)" : "Adjustments (out)"}
                value={Math.abs(totals.adjustment)}
                tone={totals.adjustment >= 0 ? "in" : "out"}
              />
            )}
            {!loading &&
              totals.walletIn === 0 &&
              totals.walletOut === 0 &&
              totals.expense === 0 &&
              totals.workerPayment === 0 &&
              totals.adjustment === 0 && (
                <p className="py-4 text-center text-sm text-[#7A9BB8]">No entries in this period.</p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

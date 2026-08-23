"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { cachedApiJson, invalidateClientCache } from "@/lib/clientDataCache";
import {
  calculateProfitabilitySummary,
  formatProfitCurrency,
  type ProfitabilityExpenseBreakdown,
} from "@/lib/profitability";
import { useConfig } from "../context/ConfigContext";

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fieldClass() {
  return "ui-input !min-h-[44px]";
}

function ProfitRowAmount({
  gross,
  included,
  muted,
}: {
  gross: number;
  included: number;
  muted?: boolean;
}) {
  const showGross = gross !== included;
  return (
    <div className="shrink-0 text-right leading-tight">
      <span
        className={`font-semibold tabular-nums ${muted ? "text-[var(--text-faint)]" : "text-[var(--foreground)]"}`}
      >
        {formatProfitCurrency(included)}
      </span>
      {showGross ? (
        <span className="block text-[10px] tabular-nums text-[var(--text-faint)] line-through">
          {formatProfitCurrency(gross)}
        </span>
      ) : null}
    </div>
  );
}

export default function ProfitabilityPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [from, setFrom] = useState(monthStartISO);
  const [to, setTo] = useState(todayISO);
  const [tonnage, setTonnage] = useState("");
  const [ratePerTon, setRatePerTon] = useState("");
  const [breakdown, setBreakdown] = useState<ProfitabilityExpenseBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingCategory, setTogglingCategory] = useState<string | null>(null);
  const [togglingRequester, setTogglingRequester] = useState<string | null>(null);

  const enabled = !!config?.features?.profitability;

  useEffect(() => {
    if (config && !enabled) {
      router.replace("/");
    }
  }, [config, enabled, router]);

  const loadBreakdown = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const { data } = await cachedApiJson<ProfitabilityExpenseBreakdown>(
        `/api/profitability?${params}`,
        30_000
      );
      if (!data) throw new Error("Could not load expenses");
      setBreakdown(data);
    } catch {
      setError("Could not load expense data for this period.");
      setBreakdown(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, from, to]);

  useEffect(() => {
    loadBreakdown();
  }, [loadBreakdown]);

  async function toggleCategoryExclude(category: string, excluded: boolean) {
    setTogglingCategory(category);
    setError("");
    try {
      const res = await apiFetch("/api/profitability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, excluded, from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update category");
      setBreakdown(data);
      invalidateClientCache("/api/profitability");
    } catch {
      setError("Could not update category exclusion.");
    } finally {
      setTogglingCategory(null);
    }
  }

  async function toggleRequesterExclude(name: string, excluded: boolean) {
    setTogglingRequester(name);
    setError("");
    try {
      const res = await apiFetch("/api/profitability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedBy: name, excluded, from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update requested by");
      setBreakdown(data);
      invalidateClientCache("/api/profitability");
    } catch {
      setError("Could not update requested by exclusion.");
    } finally {
      setTogglingRequester(null);
    }
  }

  const tonnageNum = Number(tonnage) || 0;
  const rateNum = Number(ratePerTon) || 0;

  const summary = useMemo(() => {
    if (!breakdown) return null;
    return calculateProfitabilitySummary({
      tonnage: tonnageNum,
      ratePerTon: rateNum,
      expenses: breakdown,
    });
  }, [breakdown, tonnageNum, rateNum]);

  if (config && !enabled) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto max-w-md px-4 py-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0B4A8C] shadow-sm ring-1 ring-[var(--border-soft)]"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#0B4A8C]">Profitability</h1>
            <p className="text-xs text-[var(--text-muted)]">Revenue vs site expenses</p>
          </div>
        </header>

        <div className="ui-card mb-4 space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            Period
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="ui-label">From date</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={fieldClass()}
              />
            </div>
            <div>
              <label className="ui-label">To date</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={fieldClass()}
              />
            </div>
          </div>
        </div>

        <div className="ui-card mb-4 space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            Production &amp; rate
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="ui-label">Total tonnage</label>
              <input
                type="text"
                inputMode="decimal"
                value={tonnage}
                onChange={(e) => setTonnage(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 500"
                className={fieldClass()}
              />
            </div>
            <div>
              <label className="ui-label">Company rate / ton</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#0B4A8C]">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ratePerTon}
                  onChange={(e) => setRatePerTon(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Rate"
                  className={`${fieldClass()} flex-1`}
                />
              </div>
            </div>
          </div>
          {summary && tonnageNum > 0 && rateNum > 0 ? (
            <div className="rounded-xl bg-[#EEF5FC] px-3 py-2.5 text-sm text-[#0B4A8C]">
              <span className="font-medium">Gross revenue</span>
              <span className="ml-2 font-bold tabular-nums">
                {formatProfitCurrency(summary.grossRevenue)}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                {tonnageNum.toLocaleString("en-IN")} t × {formatProfitCurrency(rateNum)}
              </span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B4A8C] border-t-transparent" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : breakdown ? (
          <>
            <div className="ui-card mb-4 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--foreground)]">Total expenses</span>
                <span className="text-xl font-bold tabular-nums text-[#7A5E10]">
                  {formatProfitCurrency(breakdown.totalExpenses)}
                </span>
              </div>
              {breakdown.excludedAmount > 0 ? (
                <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                  Excluded from profit:{" "}
                  <span className="font-semibold tabular-nums text-amber-700">
                    {formatProfitCurrency(breakdown.excludedAmount)}
                  </span>
                </p>
              ) : null}
            </div>

            {breakdown.allCategories.length > 0 && (
              <div className="ui-card mb-4 p-4">
                <p className="text-sm font-semibold text-[#0B4A8C]">
                  Category breakdown ({breakdown.allCategories.length})
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Tick to exclude a category. Amount shown is what counts in total (after person
                  exclusions below).
                </p>
                <ul className="mt-3 space-y-2">
                  {breakdown.allCategories.map((row) => {
                    const busy = togglingCategory === row.category;
                    return (
                      <li
                        key={row.category}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
                          row.excluded
                            ? "border-amber-200 bg-amber-50/60"
                            : "border-[var(--border-soft)] bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={row.excluded}
                          disabled={busy}
                          onChange={(e) => toggleCategoryExclude(row.category, e.target.checked)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#0B4A8C] focus:ring-[#0B4A8C] disabled:opacity-50"
                          aria-label={`Exclude ${row.category} from profit`}
                        />
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            row.excluded ? "text-amber-900/70 line-through" : "text-[var(--text-muted)]"
                          }`}
                        >
                          {row.category}
                          <span className="ml-1 text-[10px] uppercase text-[var(--text-faint)] no-underline">
                            ({row.bucket})
                          </span>
                        </span>
                        <ProfitRowAmount
                          gross={row.amount}
                          included={row.includedAmount}
                          muted={row.excluded || row.includedAmount === 0}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {breakdown.allRequesters.length > 0 && (
              <div className="ui-card mb-4 p-4">
                <p className="text-sm font-semibold text-[#0B4A8C]">
                  Requested by ({breakdown.allRequesters.length})
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Tick supporting staff to exclude their expenses (e.g. Nellai, Arjun).
                </p>
                <ul className="mt-3 space-y-2">
                  {breakdown.allRequesters.map((row) => {
                    const busy = togglingRequester === row.name;
                    return (
                      <li
                        key={row.name}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
                          row.excluded
                            ? "border-sky-200 bg-sky-50/60"
                            : "border-[var(--border-soft)] bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={row.excluded}
                          disabled={busy}
                          onChange={(e) => toggleRequesterExclude(row.name, e.target.checked)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#0B4A8C] focus:ring-[#0B4A8C] disabled:opacity-50"
                          aria-label={`Exclude ${row.name} from profit`}
                        />
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            row.excluded ? "text-sky-900/70 line-through" : "text-[var(--text-muted)]"
                          }`}
                        >
                          {row.name}
                          <span className="ml-1 text-[10px] text-[var(--text-faint)] no-underline">
                            ({row.entryCount} entr{row.entryCount === 1 ? "y" : "ies"})
                          </span>
                        </span>
                        <ProfitRowAmount
                          gross={row.amount}
                          included={row.includedAmount}
                          muted={row.excluded || row.includedAmount === 0}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {summary && tonnageNum > 0 && rateNum > 0 ? (
              <div className="ui-card overflow-hidden p-0">
                <div className="bg-gradient-to-br from-[#0B4A8C] to-[#062f5c] px-4 py-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">
                    Net result
                  </p>
                  <p
                    className={`mt-1 text-3xl font-bold tabular-nums ${
                      summary.netProfit >= 0 ? "text-white" : "text-red-200"
                    }`}
                  >
                    {formatProfitCurrency(summary.netProfit)}
                  </p>
                  <p className="mt-1 text-xs text-white/60">Net profit (revenue − expenses)</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100">
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase text-[var(--text-faint)]">
                      Profit / ton
                    </p>
                    <p
                      className={`mt-1 text-base font-bold tabular-nums ${
                        summary.profitPerTon >= 0 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {formatProfitCurrency(summary.profitPerTon)}
                    </p>
                  </div>
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase text-[var(--text-faint)]">
                      Margin
                    </p>
                    <p className="mt-1 text-base font-bold tabular-nums text-[#0B4A8C]">
                      {summary.grossRevenue > 0
                        ? `${((summary.netProfit / summary.grossRevenue) * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--border-soft)] bg-white px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                Enter <strong>tonnage</strong> and <strong>rate per ton</strong> to see net profit
                and profit per ton.
              </p>
            )}

          </>
        ) : null}
      </div>
    </div>
  );
}

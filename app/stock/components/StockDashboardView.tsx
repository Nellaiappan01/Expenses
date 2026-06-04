"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDayMonthName, formatDateDDMMYYYY, toLocalDateString } from "@/lib/dateFormat";

function EntryStamp({ date }: { date: string }) {
  return (
    <span className="shrink-0 text-xs font-medium text-zinc-500">
      {formatDayMonthName(date)}
    </span>
  );
}

export type DashboardDay = {
  date: string;
  inCount: number;
  outCount: number;
  checkCount: number;
  netCount: number;
  entries: {
    name: string;
    diff: number;
    type: "in" | "out" | "check";
    at?: string | null;
    date?: string;
  }[];
};

export type DashboardSummary = {
  godownUnits: number;
  itemCount?: number;
  periodIn: number;
  periodOut: number;
  netMovement: number;
};

export type DashboardRange = {
  from: string;
  to: string;
  mode: "preset" | "custom";
  days: number;
};

type Props = {
  days: DashboardDay[];
  summary: DashboardSummary;
  range: DashboardRange | null;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  onApplyCustom: () => void;
  loading?: boolean;
};

export function StockDashboardView({
  days,
  summary,
  range,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
  loading,
}: Props) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    if (days[0]?.date) setExpandedDate(days[0].date);
  }, [days]);

  const periodLabel = range
    ? `${formatDateDDMMYYYY(range.from)} – ${formatDateDDMMYYYY(range.to)}`
    : "Select dates";
  const net = summary.netMovement;

  const dateRangePicker = (
    <div className="stock-hub-stagger rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
      <p className="mb-2 text-xs font-bold text-zinc-600">From – To dates</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
            From
          </span>
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="w-full rounded-xl bg-zinc-50 px-2 py-2.5 text-sm font-medium ring-1 ring-zinc-200"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
            To
          </span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            max={toLocalDateString()}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="w-full rounded-xl bg-zinc-50 px-2 py-2.5 text-sm font-medium ring-1 ring-zinc-200"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onApplyCustom}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
      >
        Show report
      </button>
    </div>
  );

  if (loading && days.length === 0) {
    return (
      <>
        {dateRangePicker}
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </>
    );
  }

  if (days.length === 0) {
    return (
      <>
        {dateRangePicker}
        <div className="stock-tally-enter rounded-3xl bg-white p-8 text-center ring-1 ring-zinc-200">
          <p className="text-lg font-semibold text-zinc-800">No movement in this period</p>
          <p className="mt-2 text-sm text-zinc-500">
            {range
              ? `${formatDateDDMMYYYY(range.from)} – ${formatDateDDMMYYYY(range.to)}`
              : "Pick dates and tap Show report"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Godown now: {summary.godownUnits.toLocaleString("en-IN")} pcs
          </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link
            href="/stock/in"
            className="rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white"
          >
            + Stock In
          </Link>
          <Link
            href="/stock/out"
            className="rounded-2xl bg-red-50 py-3 text-sm font-bold text-red-700 ring-1 ring-red-100"
          >
            − Stock Out
          </Link>
        </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {dateRangePicker}

      {loading && (
        <div className="flex justify-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {/* Simple summary */}
      <div className="stock-hub-stagger stock-hub-stagger-1 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 p-[2px] shadow-lg shadow-emerald-600/20">
        <div className="rounded-[22px] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {periodLabel}
          </p>
          {range && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {days.length} day{days.length !== 1 ? "s" : ""} with activity
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-emerald-50 py-3 text-center ring-1 ring-emerald-100">
              <p className="text-[10px] font-semibold text-emerald-700">Received</p>
              <p className="text-2xl font-black text-emerald-700">+{summary.periodIn}</p>
            </div>
            <div className="rounded-2xl bg-red-50 py-3 text-center ring-1 ring-red-100">
              <p className="text-[10px] font-semibold text-red-700">Sold / out</p>
              <p className="text-2xl font-black text-red-700">−{summary.periodOut}</p>
            </div>
            <div className="rounded-2xl bg-zinc-900 py-3 text-center">
              <p className="text-[10px] font-semibold text-zinc-400">Net</p>
              <p className={`text-2xl font-black ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {net >= 0 ? "+" : ""}
                {net}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
            <span className="text-sm text-zinc-600">Godown now</span>
            <span className="text-lg font-bold tabular-nums text-zinc-900">
              {summary.godownUnits.toLocaleString("en-IN")} pcs
            </span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="stock-hub-stagger stock-hub-stagger-2 grid grid-cols-3 gap-2">
        <Link
          href="/stock"
          className="rounded-2xl bg-zinc-100 py-3 text-center text-xs font-bold text-zinc-700 ring-1 ring-zinc-200 active:scale-95"
        >
          Godown
        </Link>
        <Link
          href="/stock/in"
          className="rounded-2xl bg-emerald-50 py-3 text-center text-xs font-bold text-emerald-800 ring-1 ring-emerald-100 active:scale-95"
        >
          + In
        </Link>
        <Link
          href="/stock/out"
          className="rounded-2xl bg-red-50 py-3 text-center text-xs font-bold text-red-800 ring-1 ring-red-100 active:scale-95"
        >
          − Out
        </Link>
      </div>

      <p className="px-1 text-xs text-zinc-500">
        {days.length} dates · tap to see stock in / out
      </p>

      {/* Days list */}
      <div className="space-y-2">
        {days.map((day, idx) => {
          const open = expandedDate === day.date;
          const ins = day.entries.filter((e) => e.type === "in");
          const outs = day.entries.filter((e) => e.type === "out");

          return (
            <div
              key={day.date}
              className="stock-day-card overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-100 transition-shadow duration-300"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <button
                type="button"
                onClick={() => setExpandedDate(open ? null : day.date)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-zinc-900">{formatDateDDMMYYYY(day.date)}</p>
                  <p className="text-xs text-zinc-500">
                    {ins.length} in · {outs.length} out
                    {day.checkCount > 0 && ` · ${day.checkCount} counted`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm font-bold tabular-nums">
                  {day.inCount > 0 && (
                    <span className="text-emerald-600">+{day.inCount}</span>
                  )}
                  {day.outCount > 0 && (
                    <span className="text-red-600">−{day.outCount}</span>
                  )}
                </div>
                <svg
                  className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (ins.length > 0 || outs.length > 0) && (
                <div className="border-t border-zinc-100 px-3 pb-3 pt-2 stock-tally-enter">
                  {ins.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase text-emerald-700">
                        Stock in
                      </p>
                      <ul className="space-y-1">
                        {ins.map((e, i) => (
                          <li
                            key={`in-${e.name}-${e.at ?? i}`}
                            className="stock-list-in flex items-center gap-2 rounded-lg bg-emerald-50/80 px-3 py-2 text-sm"
                            style={{ animationDelay: `${i * 0.03}s` }}
                          >
                            <span className="min-w-0 flex-1 truncate text-zinc-800">{e.name}</span>
                            <EntryStamp date={e.date ?? day.date} />
                            <span className="shrink-0 font-bold text-emerald-700">+{e.diff}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {outs.length > 0 && (
                    <div>
                      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase text-red-700">
                        Stock out
                      </p>
                      <ul className="space-y-1">
                        {outs.map((e, i) => (
                          <li
                            key={`out-${e.name}-${e.at ?? i}`}
                            className="stock-list-in flex items-center gap-2 rounded-lg bg-red-50/80 px-3 py-2 text-sm"
                            style={{ animationDelay: `${i * 0.03}s` }}
                          >
                            <span className="min-w-0 flex-1 truncate text-zinc-800">{e.name}</span>
                            <EntryStamp date={e.date ?? day.date} />
                            <span className="shrink-0 font-bold text-red-700">
                              {e.diff}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

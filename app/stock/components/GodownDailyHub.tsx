"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type TallyData = {
  checkedToday: number;
  summary: {
    godownUnits: number;
    itemCount: number;
    inStockCount: number;
    outOfStockCount: number;
    checkedInStock: number;
    checkedNil: number;
    nilPending?: number;
  };
  eveningComplete?: boolean;
};

type Props = {
  onStartEvening: () => void;
  refreshKey?: number;
};

export function GodownDailyHub({ onStartEvening, refreshKey = 0 }: Props) {
  const [data, setData] = useState<TallyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/stock/tally?days=1")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="mb-5">
        <div className="h-24 animate-pulse rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200/80" />
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const inStock = s.inStockCount ?? 0;
  const nilCount = s.outOfStockCount ?? 0;
  const checkedStock = s.checkedInStock ?? 0;
  const checkedNil = s.checkedNil ?? 0;
  const progress =
    s.itemCount > 0 ? Math.round((data.checkedToday / s.itemCount) * 100) : 0;

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={onStartEvening}
        className="stock-hub-stagger stock-hub-stagger-1 block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 p-[1px] text-left shadow-lg shadow-emerald-600/25 transition-transform active:scale-[0.99]"
      >
        <div className="rounded-[23px] bg-white/95 p-4 backdrop-blur-sm dark:bg-zinc-900/95">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Evening check
              </p>
              <p className="text-2xl font-bold tabular-nums text-zinc-900">
                {data.checkedToday}
                <span className="text-lg font-medium text-zinc-400">/{s.itemCount}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                <span className="font-semibold text-emerald-700">
                  {checkedStock}/{inStock}
                </span>{" "}
                in stock
                {nilCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-amber-700">
                      {checkedNil}/{nilCount}
                    </span>{" "}
                    nil
                  </>
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-right ring-1 ring-zinc-100">
              <p className="text-[10px] font-medium text-zinc-500">Godown pcs</p>
              <p className="text-lg font-bold tabular-nums text-zinc-900">
                {s.godownUnits.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="stock-progress-shine relative h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
              style={{ width: `${Math.max(progress, 4)}%` }}
            />
          </div>

        </div>
      </button>
    </div>
  );
}

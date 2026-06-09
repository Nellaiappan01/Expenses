"use client";

import { formatDateTimeDDMMYYYY } from "@/lib/dateFormat";
import { itemsLastGodownCheck } from "@/lib/stockLastUpdate";
import type { StockItem } from "@/lib/stockTypes";

type Props = {
  items: StockItem[];
  onStartCheck: () => void;
};

export function GodownDailyHub({ items, onStartCheck }: Props) {
  if (items.length === 0) return null;

  const itemCount = items.length;
  const godownUnits = items.reduce((sum, item) => sum + item.count, 0);
  const lastGodownCheck = itemsLastGodownCheck(items);

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={onStartCheck}
        className="stock-hub-stagger stock-hub-stagger-1 block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 p-[1px] text-left shadow-lg shadow-emerald-600/25 transition-transform active:scale-[0.99]"
      >
        <div className="rounded-[23px] bg-white/95 p-4 backdrop-blur-sm dark:bg-zinc-900/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Godown stock check
              </p>
              <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 ring-2 ring-amber-300/80 dark:bg-amber-950/30 dark:ring-amber-700/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Last check
                </p>
                <p className="text-sm font-bold tabular-nums text-amber-950 dark:text-amber-100">
                  {lastGodownCheck
                    ? formatDateTimeDDMMYYYY(lastGodownCheck)
                    : "Not recorded yet"}
                </p>
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                <span className="font-semibold text-zinc-800">{itemCount}</span> patterns
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-right ring-1 ring-zinc-100 dark:bg-zinc-800 dark:ring-zinc-700">
              <p className="text-[10px] font-medium text-zinc-500">Godown pcs</p>
              <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {godownUnits.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-xs font-semibold text-emerald-700">
            Tap to start stock check
          </p>
        </div>
      </button>
    </div>
  );
}

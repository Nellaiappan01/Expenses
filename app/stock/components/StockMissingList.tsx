"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type TallyItem = {
  _id: string;
  name: string;
  godown: number;
  periodIn: number;
  periodOut: number;
  net: number;
  status: "ok" | "missing" | "low" | "shrink";
  lastCheckDiff: number | null;
};

export function StockMissingList({ days = 7 }: { days?: 7 | 15 | 30 }) {
  const [items, setItems] = useState<TallyItem[]>([]);

  useEffect(() => {
    apiFetch(`/api/stock/tally?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const flagged = (data?.items ?? []).filter(
          (i: TallyItem) => i.status !== "ok"
        ) as TallyItem[];
        setItems(flagged.slice(0, 8));
      });
  }, [days]);

  if (items.length === 0) return null;

  const labels = {
    missing: { text: "Out of stock", class: "bg-red-100 text-red-700" },
    low: { text: "Low", class: "bg-amber-100 text-amber-800" },
    shrink: { text: "Shrinkage", class: "bg-orange-100 text-orange-800" },
  };

  return (
    <div className="stock-tally-enter mb-4 rounded-2xl bg-white p-4 ring-1 ring-amber-200/80">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Tally alerts ({items.length})
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={item._id}
            className="stock-list-in flex items-center justify-between gap-2 text-sm"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <span className="min-w-0 truncate font-medium text-zinc-800">{item.name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-zinc-500">
                Godown {item.godown}
                {item.periodIn > 0 || item.periodOut > 0
                  ? ` · +${item.periodIn}/-${item.periodOut}`
                  : ""}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${labels[item.status].class}`}
              >
                {labels[item.status].text}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

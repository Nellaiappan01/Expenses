"use client";

import { useState } from "react";
import { getPatternImageUrl } from "@/lib/patternImageUrl";
import { BrandBadge } from "./BrandBadge";
import type { StockViewStatus } from "@/lib/publicStock";
import type { ViewStockItem } from "./PatternDetailSheet";

const STATUS_LABEL: Record<StockViewStatus, { label: string; class: string }> = {
  in: { label: "Available", class: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  low: { label: "Low", class: "bg-amber-50 text-amber-800 ring-amber-200" },
  out: { label: "Out", class: "bg-red-50 text-red-700 ring-red-200" },
};

const ROW_HIGHLIGHT: Record<StockViewStatus, string> = {
  in: "hover:bg-blue-50/90 hover:shadow-[inset_3px_0_0_0_rgb(59,130,246)]",
  low: "bg-amber-50/30 hover:bg-amber-50/70 hover:shadow-[inset_3px_0_0_0_rgb(245,158,11)]",
  out: "bg-red-50/25 hover:bg-red-50/60 hover:shadow-[inset_3px_0_0_0_rgb(239,68,68)]",
};

function Thumb({ item }: { item: ViewStockItem }) {
  const [failed, setFailed] = useState(false);
  const src = getPatternImageUrl(item);

  if (!src || failed) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 ring-1 ring-slate-200">
        <svg className="h-5 w-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 ${item.status === "out" ? "grayscale opacity-70" : ""}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

type Props = {
  items: ViewStockItem[];
  onSelect: (item: ViewStockItem) => void;
};

export function PatternTable({ items, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
      <div className="sm:overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-sm sm:min-w-[520px] sm:table-auto">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="hidden px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:table-cell sm:px-4">
                Photo
              </th>
              <th className="hidden px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:table-cell sm:px-4">
                Brand
              </th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                Pattern
              </th>
              <th className="w-[4.5rem] px-2 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:w-auto sm:px-4">
                Qty
              </th>
              <th className="hidden px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:table-cell md:px-4">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const st = STATUS_LABEL[item.status];
              return (
                <tr
                  key={item._id}
                  className={`stock-view-table-row group cursor-pointer border-b border-slate-50 transition-all duration-200 ${ROW_HIGHLIGHT[item.status]}`}
                  style={{ animationDelay: `${Math.min(i * 0.025, 0.5)}s` }}
                  onClick={() => onSelect(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(item);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                    <Thumb item={item} />
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                    {item.brand ? <BrandBadge brand={item.brand} size="xs" /> : "—"}
                  </td>
                  <td className="min-w-0 px-3 py-2.5 sm:px-4">
                    <p
                      className="truncate font-bold text-slate-900 group-hover:text-blue-700"
                      title={item.name}
                    >
                      {item.name}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right sm:px-4">
                    <span
                      className={`inline-block rounded-lg px-2 py-1 text-sm font-extrabold tabular-nums sm:px-2.5 ${
                        item.status === "out"
                          ? "text-red-600"
                          : item.status === "low"
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {item.count}
                      <span className="ml-0.5 text-[10px] font-bold text-slate-400 sm:ml-1">PCS</span>
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell md:px-4">
                    {item.status === "in" ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${st.class}`}
                      >
                        {st.label}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

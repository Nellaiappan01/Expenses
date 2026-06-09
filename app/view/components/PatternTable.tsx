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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                Photo
              </th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                Pattern
              </th>
              <th className="hidden px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:table-cell sm:px-4">
                Brand
              </th>
              <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
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
                  <td className="px-3 py-2.5 sm:px-4">
                    <Thumb item={item} />
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    <p className="font-bold text-slate-900 group-hover:text-blue-700">{item.name}</p>
                    {item.size && (
                      <p className="mt-0.5 text-xs text-slate-500 sm:hidden">{item.size}</p>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                    {item.brand ? <BrandBadge brand={item.brand} size="xs" /> : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right sm:px-4">
                    <span
                      className={`inline-block rounded-lg px-2.5 py-1 text-sm font-extrabold tabular-nums ${
                        item.status === "out"
                          ? "text-red-600"
                          : item.status === "low"
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {item.count}
                      <span className="ml-1 text-[10px] font-bold text-slate-400">PCS</span>
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

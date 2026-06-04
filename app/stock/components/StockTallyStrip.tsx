"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type TallySummary = {
  godownUnits: number;
  godownValue: number;
  periodIn: number;
  periodOut: number;
  netMovement: number;
  itemCount: number;
  correctionCount: number;
};

type Props = {
  days?: 7 | 15 | 30;
  compact?: boolean;
  showLinks?: boolean;
};

export function StockTallyStrip({ days = 7, compact, showLinks = true }: Props) {
  const [summary, setSummary] = useState<TallySummary | null>(null);
  const [tallyOk, setTallyOk] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/stock/tally?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.summary) {
          setSummary(data.summary);
          setTallyOk(!!data.tallyOk);
        }
      })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="stock-tally-enter mb-4 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-200/80" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="stock-tally-enter mb-4 space-y-2">
      {!tallyOk && (
        <div className="stock-alert-pulse flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
          <span>⚠ Missing In/Out entries</span>
          {summary.correctionCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
              {summary.correctionCount} to fix
            </span>
          )}
        </div>
      )}

      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
        <TallyCell
          label="Godown"
          value={summary.godownUnits.toLocaleString("en-IN")}
          sub={`${summary.itemCount} SKUs`}
          tone="zinc"
        />
        <TallyCell
          label="Stock In"
          value={`+${summary.periodIn}`}
          sub={`${days}d`}
          tone="in"
        />
        <TallyCell
          label="Stock Out"
          value={`-${summary.periodOut}`}
          sub={`${days}d`}
          tone="out"
        />
        {!compact && (
          <TallyCell
            label="Net"
            value={`${summary.netMovement >= 0 ? "+" : ""}${summary.netMovement}`}
            sub="in − out"
            tone={summary.netMovement >= 0 ? "in" : "out"}
          />
        )}
      </div>

      {showLinks && (
        <div className="flex gap-2 text-xs">
          <Link href="/stock/in" className="flex-1 rounded-xl bg-emerald-600/10 py-2 text-center font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
            Stock In
          </Link>
          <Link href="/stock/out" className="flex-1 rounded-xl bg-red-50 py-2 text-center font-semibold text-red-700 ring-1 ring-red-200">
            Stock Out
          </Link>
          <Link href="/stock" className="flex-1 rounded-xl bg-zinc-100 py-2 text-center font-medium text-zinc-700">
            Godown
          </Link>
        </div>
      )}
    </div>
  );
}

function TallyCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "zinc" | "in" | "out";
}) {
  const bg =
    tone === "in"
      ? "bg-emerald-50 ring-emerald-100"
      : tone === "out"
        ? "bg-red-50 ring-red-100"
        : "bg-white ring-zinc-100";
  const val =
    tone === "in"
      ? "text-emerald-700"
      : tone === "out"
        ? "text-red-700"
        : "text-zinc-900";

  return (
    <div className={`stock-cell-pop rounded-2xl p-3 ring-1 ${bg}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${val}`}>{value}</p>
      <p className="text-[10px] text-zinc-400">{sub}</p>
    </div>
  );
}

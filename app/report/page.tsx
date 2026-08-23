"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";

function getDateRange(preset: "today" | "week" | "month") {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const from = new Date(now);
  if (preset === "today") from.setDate(from.getDate());
  else if (preset === "week") from.setDate(from.getDate() - 6);
  else from.setMonth(from.getMonth() - 1);
  return { from: from.toISOString().split("T")[0], to };
}

function fieldClass() {
  return "w-full rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-sm text-[#0B4A8C] outline-none placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
      {children}
    </label>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const businessLabel = config?.branding?.appName || "Your business";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activePreset, setActivePreset] = useState<"today" | "week" | "month" | null>(null);

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasAny = features.expenses || features.workers || features.stock;
    if (config && !hasAny) {
      router.replace("/");
    }
  }, [config, router]);

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers && !features.stock) return null;
  const hasLedger = features.expenses || features.workers;

  function setDatePreset(preset: "today" | "week" | "month") {
    const { from: f, to: t } = getDateRange(preset);
    setFrom(f);
    setTo(t);
    setActivePreset(preset);
  }

  async function downloadReport() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (search.trim()) params.set("search", search.trim());
      const res = await apiFetch(`/api/export/report?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = from && to ? `${from}_to_${to}` : new Date().toISOString().split("T")[0];
      a.download = `ledger-${suffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F8FC]">
      <div className="mx-auto max-w-md px-4 py-6 pb-28">
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
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#0B4A8C]">Report</h1>
            <p className="truncate text-sm text-[#5A7FA5]">{businessLabel}</p>
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F2FA] text-[#0B4A8C]"
            aria-hidden
          >
            <ExcelIcon className="h-5 w-5" />
          </div>
        </header>

        <div className="rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["today", "Today"],
                ["week", "7 days"],
                ["month", "30 days"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDatePreset(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activePreset === key
                    ? "bg-[#0B4A8C] text-white"
                    : "bg-[#F8FBFE] text-[#0B4A8C]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>From</FieldLabel>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setActivePreset(null);
                }}
                className={fieldClass()}
              />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setActivePreset(null);
                }}
                className={fieldClass()}
              />
            </div>
          </div>

          {hasLedger && (
            <div className="mt-3">
              <FieldLabel>Search</FieldLabel>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Optional — name, category, note…"
                className={fieldClass()}
              />
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={downloadReport}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B4A8C] py-3.5 text-base font-bold text-white hover:bg-[#083A6E] disabled:opacity-60"
          >
            <ExcelIcon className="h-5 w-5" />
            {loading ? "Preparing…" : "Download Excel"}
          </button>

          <p className="mt-3 text-center text-[11px] text-[#9BB5CC]">
            Ledger with opening & closing balance · Mon 16 Jun 2026
          </p>
        </div>
      </div>
    </div>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-5-6z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

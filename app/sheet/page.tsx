"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { OpeningMode } from "@/lib/sheetTabs";
import { useConfig } from "../context/ConfigContext";
import { useUser } from "../context/UserContext";

type Preview = {
  activeSheetName: string;
  balanceSheetName: string;
  previousClosing: number | null;
  tabNames: string[];
};

const PREVIEW_CACHE_KEY = "ledger_sheet_preview";
const fieldLabel = "mb-1 block text-xs font-medium uppercase tracking-wide text-[#5A7FA5]";
const fieldInput =
  "w-full rounded-xl border border-[#D6E6F5] bg-white px-4 py-3.5 text-base text-[#0B4A8C] placeholder-[#9BB5CC] outline-none transition-colors focus:border-[#0B4A8C] focus:ring-2 focus:ring-[#0B4A8C]/15 [font-size:16px]";
const amountInput =
  "w-full rounded-xl border border-[#D6E6F5] bg-white px-4 py-3.5 text-xl font-semibold tabular-nums text-[#0B4A8C] placeholder-[#9BB5CC] outline-none transition-colors focus:border-[#0B4A8C] focus:ring-2 focus:ring-[#0B4A8C]/15 [font-size:16px]";

function formatRupees(amount: number) {
  const formatted = Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return amount < 0 ? `₹ -${formatted}` : `₹ ${formatted}`;
}

function readPreviewCache(userId: string): Preview | null {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(PREVIEW_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; preview?: Preview };
    if (parsed.userId !== userId || !parsed.preview?.activeSheetName) return null;
    return parsed.preview;
  } catch {
    return null;
  }
}

function writePreviewCache(userId: string, preview: Preview) {
  if (!userId) return;
  try {
    sessionStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify({ userId, preview }));
  } catch {
    // ignore
  }
}

export default function SheetPage() {
  const router = useRouter();
  const { userId } = useUser();
  const { config } = useConfig() ?? {};
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [mode, setMode] = useState<OpeningMode>("carry");
  const [customAmount, setCustomAmount] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [ledgerOpening, setLedgerOpening] = useState<number | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/sheets/tabs");
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || "Could not read the Google Sheet");
      const next: Preview = {
        activeSheetName: data.activeSheetName,
        balanceSheetName:
          typeof data.balanceSheetName === "string" && data.balanceSheetName.trim()
            ? data.balanceSheetName.trim()
            : data.activeSheetName,
        previousClosing: typeof data.previousClosing === "number" ? data.previousClosing : null,
        tabNames: Array.isArray(data.tabNames) ? data.tabNames : [],
      };
      setPreview(next);
      if (userId) writePreviewCache(userId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the Google Sheet");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    if (config && !features.expenses && !features.workers) {
      router.replace(features.stock ? "/stock" : "/");
    }
  }, [config, router]);

  useEffect(() => {
    if (!userId) return;
    const cached = readPreviewCache(userId);
    if (cached) setPreview(cached);
  }, [userId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/balance")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.net === "number") setLedgerOpening(data.net);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const oldSheetName =
    preview && preview.balanceSheetName && preview.balanceSheetName !== preview.activeSheetName
      ? preview.balanceSheetName
      : "";
  const sheetClosing = preview?.previousClosing ?? null;
  const carryOpening =
    sheetClosing !== null && sheetClosing !== 0
      ? sheetClosing
      : ledgerOpening;
  const opening =
    mode === "carry"
      ? carryOpening
      : customAmount.trim()
        ? Number(customAmount.replace(/[₹,\s]/g, ""))
        : null;
  const openingReady = opening !== null && Number.isFinite(opening);
  const canReview = Boolean(preview && sheetName.trim() && openingReady);

  function handleReview(event: React.FormEvent) {
    event.preventDefault();
    if (!canReview || saving) return;
    setError("");
    setReviewing(true);
  }

  async function handleCreate() {
    if (!preview || !openingReady || opening === null || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/sheets/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetName: sheetName.trim(),
          mode,
          customAmount: mode === "custom" ? opening : null,
          expectedPreviousSheet: preview.activeSheetName,
          confirmedOpening: opening,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || "Could not create the sheet");
      setCreatedName(data.sheetName || sheetName.trim());
      setReviewing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create the sheet";
      setReviewing(false);
      await loadPreview();
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers) return null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-md px-3 py-4 pb-12 sm:px-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            aria-label="Back to home"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Sheet</h1>
            <p className="text-sm text-zinc-500">New tab in the same Google Sheet</p>
          </div>
        </header>

        {createdName ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#0B4A8C]">{createdName} is updated.</p>
            <p className="mt-2 text-sm text-zinc-600">
              The wallet opening balance now starts from this sheet. Earlier entries stay on the old tabs.
            </p>
            <Link href="/" className="ui-btn-primary mt-4">
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReview} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="rounded-xl bg-[#F4F8FC] px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#5A7FA5]">Active sheet</p>
              <p className="mt-1 text-base font-semibold text-[#0B4A8C]">
                {preview?.activeSheetName || (loading ? "Reading the sheet…" : "Not loaded")}
              </p>
              {oldSheetName ? (
                <>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#5A7FA5]">Old sheet</p>
                  <p className="mt-1 text-base font-semibold text-[#0B4A8C]">{oldSheetName}</p>
                </>
              ) : null}
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#5A7FA5]">Opening balance</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-[#0B4A8C]">
                {opening !== null && Number.isFinite(opening)
                  ? formatRupees(opening)
                  : loading
                    ? "Reading…"
                    : "No closing balance yet"}
              </p>
            </div>

            <div>
              <label className={fieldLabel} htmlFor="sheet-name">
                New sheet name
              </label>
              <input
                id="sheet-name"
                value={sheetName}
                onChange={(event) => {
                  setSheetName(event.target.value);
                  setReviewing(false);
                }}
                className={fieldInput}
                placeholder="November 2026"
                maxLength={80}
                disabled={saving}
              />
            </div>

            <div>
              <p className={fieldLabel}>Opening balance</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("carry");
                    setReviewing(false);
                  }}
                  className={`rounded-xl px-2 py-3 text-xs font-semibold leading-tight ${
                    mode === "carry" ? "bg-[#0B4A8C] text-white" : "border border-[#D6E6F5] bg-white text-[#0B4A8C]"
                  }`}
                >
                  Auto Carry Forward
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("custom");
                    setReviewing(false);
                  }}
                  className={`rounded-xl px-2 py-3 text-xs font-semibold leading-tight ${
                    mode === "custom" ? "bg-[#0B4A8C] text-white" : "border border-[#D6E6F5] bg-white text-[#0B4A8C]"
                  }`}
                >
                  Custom Opening Balance
                </button>
              </div>
            </div>

            {mode === "custom" ? (
              <div>
                <label className={fieldLabel} htmlFor="opening-amount">
                  Custom opening balance
                </label>
                <input
                  id="opening-amount"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(event) => {
                    setCustomAmount(event.target.value);
                    setReviewing(false);
                  }}
                  className={amountInput}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
            ) : null}

            {reviewing && openingReady && opening !== null ? (
              <div className="rounded-xl border border-[#D6E6F5] bg-[#F4F8FC] px-3 py-3 text-sm">
                <p className="text-[#5A7FA5]">
                  Active sheet: <span className="font-semibold text-[#0B4A8C]">{preview?.activeSheetName}</span>
                </p>
                {oldSheetName ? (
                  <p className="mt-1 text-[#5A7FA5]">
                    Old sheet: <span className="font-semibold text-[#0B4A8C]">{oldSheetName}</span>
                  </p>
                ) : null}
                <p className="mt-1 text-[#5A7FA5]">
                  Opening balance: <span className="font-semibold text-[#0B4A8C]">{formatRupees(opening)}</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#5A7FA5]">
                  This writes the opening on the new tab only. {preview?.activeSheetName} stays unchanged.
                </p>
              </div>
            ) : null}

            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

            {reviewing ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewing(false)}
                  disabled={saving}
                  className="rounded-xl border border-zinc-300 py-3.5 text-sm font-semibold text-zinc-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className="rounded-xl bg-[#0B4A8C] py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Create New Sheet"}
                </button>
              </div>
            ) : (
              <button type="submit" disabled={!canReview || saving} className="ui-btn-primary disabled:opacity-60">
                Review opening
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

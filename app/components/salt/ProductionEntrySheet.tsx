"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { notifyLedgerDataChanged } from "@/lib/clientDataCache";
import { formatDateDisplay, toLocalDateString } from "@/lib/dateFormat";
import type { SerializedProduction } from "@/lib/dailyProduction";
import { formatProductionTonnes, productionUpdatedLabel } from "@/lib/productionDisplay";
import DdMmYyyyDateInput from "../ui/DdMmYyyyDateInput";
import SearchableDropdown from "../ui/SearchableDropdown";

function SaltGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l3.2 5.6L12 12 8.8 8.6 12 3z" fill="currentColor" />
      <path d="M7.2 10.2L12 13.4l4.8-3.2L21 18H3l4.2-7.8z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export function ProductionDeleteConfirm({
  date,
  tonnes,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  date: string;
  tonnes: number;
  deleting: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="px-5 pt-3 pb-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">Remove harvest</p>
          <h2 className="mt-0.5 text-lg font-bold text-[#7C3D00]">Delete this day’s production?</h2>
          <p className="mt-1 text-sm text-[#A16207]">
            {formatDateDisplay(date)} · {formatProductionTonnes(tonnes)} t
          </p>
          <p className="mt-2 text-xs font-medium text-[#5A7FA5]">Expenses and balance stay unchanged.</p>
        </div>
      </div>
      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="rounded-2xl bg-[#FFF8E7] py-3.5 text-sm font-bold text-[#7C3D00]"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting}
          className="rounded-2xl bg-red-600 py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {deleting ? "Removing…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

export default function ProductionEntrySheet({
  onClose,
  initialDate,
}: {
  onClose: () => void;
  initialDate?: string;
}) {
  const [date, setDate] = useState(initialDate || toLocalDateString());
  const [category, setCategory] = useState("");
  const [tonnes, setTonnes] = useState("");
  const [production, setProduction] = useState<SerializedProduction | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/defaults")
      .then((res) => (res.ok ? res.json() : { expenseCategories: [] }))
      .then((data) => setCategoryOptions(data.expenseCategories ?? []))
      .catch(() => setCategoryOptions([]));
  }, []);

  const loadForDate = useCallback(async (isoDate: string) => {
    if (!isoDate) {
      setProduction(null);
      setTonnes("");
      setCategory("");
      return;
    }
    setLoading(true);
    setError("");
    setConfirmDelete(false);
    try {
      const res = await apiFetch(`/api/production?date=${encodeURIComponent(isoDate)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load production");
      const next = (data.production as SerializedProduction | null) ?? null;
      setProduction(next);
      setTonnes(next ? String(next.tonnes) : "");
      setCategory(next?.category ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load production");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForDate(date);
  }, [date, loadForDate]);

  async function saveProduction() {
    if (saving || deleting) return;
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch("/api/production", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, tonnes, category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save production");
      const next = data.production as SerializedProduction;
      setProduction(next);
      setTonnes(String(next.tonnes));
      setCategory(next.category ?? "");
      setSaving(false);
      setSaved(true);
      notifyLedgerDataChanged();
      if (next.sheetsSyncStatus === "failed") {
        setError(
          next.sheetsSyncError ||
            "Saved in app, but Google Sheet did not update. Copy Apps Script 2026-08-31b and New version on the same web app."
        );
        setSaved(false);
        return;
      }
      window.setTimeout(() => {
        setSaved(false);
        onClose();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save production");
      setSaving(false);
    }
  }

  async function deleteProduction() {
    if (!production || saving || deleting) return;
    setError("");
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/production?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete production");
      notifyLedgerDataChanged();
      if (data.sheetsSyncStatus === "failed") {
        throw new Error(
          data.sheetsSyncError ||
            "Removed in app, but the Google Sheet row is still there. Copy Apps Script 2026-08-31b and New version, then delete again."
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete production");
      setDeleting(false);
    }
  }

  const busy = loading || saving || deleting;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-[#0B4A8C]/45 backdrop-blur-sm nav-sheet-backdrop"
        aria-label="Close production"
      />
      <div className="approve-sheet-enter fixed inset-x-0 bottom-0 z-[61] mx-auto max-w-lg overflow-hidden rounded-t-3xl border-t border-[#E8B84A] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="bg-gradient-to-r from-[#FFF8E7] to-[#FDE68A] px-5 pb-4 pt-2">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#E8B84A]" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C17F11] text-white">
                <SaltGlyph />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9A5B0C]">
                  Salt production
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-[#7C3D00]">Daily harvest</h2>
                <p className="mt-0.5 text-xs font-medium text-[#A16207]">
                  {production
                    ? `${productionUpdatedLabel(production)} · already saved`
                    : "Does not change expenses"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[#9A5B0C] hover:bg-white/70"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {confirmDelete && production ? (
          <ProductionDeleteConfirm
            date={date}
            tonnes={production.tonnes}
            deleting={deleting}
            error={error}
            onCancel={() => {
              setConfirmDelete(false);
              setError("");
            }}
            onConfirm={() => void deleteProduction()}
          />
        ) : (
          <div className="px-5 pt-4 pb-6">
            <div className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#9A5B0C]">
                  Date
                </label>
                <DdMmYyyyDateInput value={date} onChange={setDate} required ariaLabel="Production date" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#9A5B0C]">
                  Category <span className="font-semibold normal-case tracking-normal text-[#C17F11]">optional</span>
                </label>
                <SearchableDropdown
                  hideLabel
                  value={category}
                  onChange={setCategory}
                  options={categoryOptions}
                  placeholder="Pond / work (optional)"
                  addNewLabel="Add category"
                  inputClassName="ui-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#9A5B0C]">
                  Tonnage
                </label>
                <div className="flex items-center rounded-xl border border-[#E8B84A] bg-[#FFFDF6] px-3 focus-within:ring-2 focus-within:ring-[#F4C430]/70">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tonnes}
                    onChange={(e) => setTonnes(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveProduction();
                      }
                    }}
                    placeholder={loading ? "Loading…" : "0"}
                    disabled={busy}
                    aria-label="Tonnage"
                    className="min-w-0 flex-1 border-0 bg-transparent py-3.5 text-xl font-extrabold tabular-nums text-[#7C3D00] outline-none [font-size:18px]"
                  />
                  <span className="shrink-0 pl-2 text-sm font-bold text-[#C17F11]">Ton</span>
                </div>
              </div>
            </div>

            {error && !confirmDelete ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void saveProduction()}
              disabled={busy || saved}
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-60 ${
                saved ? "bg-emerald-600" : "bg-[#C17F11]"
              }`}
            >
              {saved ? (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : saving ? (
                "Saving…"
              ) : production ? (
                "Update production"
              ) : (
                "Save production"
              )}
            </button>

            {production ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setConfirmDelete(true);
                }}
                disabled={busy}
                className="mt-3 w-full py-2 text-center text-sm font-bold text-red-600 disabled:opacity-50"
              >
                Delete this day’s production
              </button>
            ) : null}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

export function SaltProductionIconButton({
  onClick,
  label = "Salt production",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E8B84A] bg-[#FFF8E7] text-[#C17F11] shadow-sm active:bg-[#FDE68A]"
    >
      <SaltGlyph />
    </button>
  );
}

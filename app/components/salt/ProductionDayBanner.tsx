"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { notifyLedgerDataChanged } from "@/lib/clientDataCache";
import type { SerializedProduction } from "@/lib/dailyProduction";
import { formatProductionTonnes, productionUpdatedLabel } from "@/lib/productionDisplay";
import ProductionEntrySheet, { ProductionDeleteConfirm } from "./ProductionEntrySheet";

export default function ProductionDayBanner({
  date,
  production,
  hideIfEmpty = false,
}: {
  date: string;
  production: SerializedProduction | null | undefined;
  hideIfEmpty?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  async function deleteProduction() {
    if (!production || deleting) return;
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
            "Removed in app, but the Google Sheet row is still there. Copy Apps Script 2026-08-31b and New version."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete production");
      setDeleting(false);
    }
  }

  return (
    <>
      {editing ? <ProductionEntrySheet initialDate={date} onClose={() => setEditing(false)} /> : null}
      {!production ? (
        hideIfEmpty ? null : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex w-full items-center justify-between border-t border-[#F3E2A8] bg-[#FFFBEB] px-4 py-1.5 text-left"
          >
            <span className="text-[10px] font-bold text-[#9A5B0C]">+ Salt production</span>
            <span className="text-[10px] font-semibold text-[#C17F11]">Ton</span>
          </button>
        )
      ) : (
        <div className="flex items-center gap-2 border-t border-[#F3E2A8] bg-[#FFF8E7] px-4 py-1.5">
          <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#9A5B0C]">
            Salt · {formatProductionTonnes(production.tonnes)} t
            <span className="ml-1.5 font-semibold text-[#B45309]">
              {productionUpdatedLabel(production)}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#C17F11]"
            aria-label="Edit production"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#B45309] disabled:opacity-50"
            aria-label="Delete production"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      )}
      {confirmDelete && production && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[70] bg-[#0B4A8C]/45 backdrop-blur-sm"
                aria-label="Close"
                onClick={() => setConfirmDelete(false)}
              />
              <div className="approve-sheet-enter fixed inset-x-0 bottom-0 z-[71] mx-auto max-w-lg rounded-t-3xl border-t border-red-100 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
                <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-red-100" aria-hidden />
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
              </div>
            </>,
            document.body
          )
        : null}
      {error && !confirmDelete ? (
        <p className="px-4 pb-1 text-[10px] font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : production?.sheetsSyncStatus === "failed" ? (
        <p className="px-4 pb-1 text-[10px] font-medium text-red-700">
          App saved. Google Sheet not updated — copy Apps Script 2026-08-31b, then New version on the same web app.
        </p>
      ) : null}
    </>
  );
}

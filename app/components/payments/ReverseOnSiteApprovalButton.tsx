"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { notifyLedgerDataChanged } from "@/lib/clientDataCache";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { canUserRevertOnSiteApproval } from "@/lib/paymentWorkflow";
import type { Entry } from "@/lib/types";
import { useUser } from "@/app/context/UserContext";

export function ReverseApprovalIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4"
      />
    </svg>
  );
}

export default function ReverseOnSiteApprovalButton({
  entry,
  compact = false,
  iconOnly = false,
  onReverted,
}: {
  entry: Entry;
  compact?: boolean;
  iconOnly?: boolean;
  onReverted?: (entry: Entry) => void;
}) {
  const { userName } = useUser();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!canUserRevertOnSiteApproval(entry) || !entry._id) return null;

  async function confirmRevert() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/entries/${entry._id}/revert-on-site-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedBy: userName || "User" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reverse");
      notifyLedgerDataChanged();
      setOpen(false);
      onReverted?.(data as Entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reverse");
    } finally {
      setSaving(false);
    }
  }

  const sheet =
    typeof document !== "undefined" && open
      ? createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-[#0B4A8C]/40 backdrop-blur-sm"
              aria-label="Close"
              onClick={() => {
                if (!saving) setOpen(false);
              }}
            />
            <div
              role="dialog"
              aria-labelledby="reverse-approval-title"
              className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#D6E6F5] sm:hidden" aria-hidden />
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
                  <ReverseApprovalIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="reverse-approval-title" className="text-base font-bold text-[#0B4A8C]">
                    Reverse approval?
                  </h2>
                  <p className="mt-1 text-sm leading-snug text-[#5A7FA5]">
                    {entry.name} · ₹{Math.abs(entry.amount).toLocaleString("en-IN")}
                    {entry.date ? ` · ${formatDateDDMMYYYY(entry.date)}` : ""}
                  </p>
                </div>
              </div>

              {error ? (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-[#D6E6F5] bg-white py-3.5 text-sm font-bold text-[#0B4A8C] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmRevert()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <ReverseApprovalIcon className="h-4 w-4" />
                  )}
                  {saving ? "Reversing…" : "Reverse"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={iconOnly ? "shrink-0" : "min-w-0"}>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setError("");
          setOpen(true);
        }}
        disabled={saving}
        className={
          iconOnly
            ? "flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-800 disabled:opacity-60"
            : compact
              ? "flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-60"
              : "flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-sm font-bold text-amber-900 disabled:opacity-60"
        }
        aria-label="Reverse approval"
        title="Reverse approval"
      >
        <ReverseApprovalIcon className={iconOnly ? "h-4 w-4" : "h-4 w-4"} />
        {iconOnly ? null : "Reverse approval"}
      </button>
      {sheet}
    </div>
  );
}

"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { formatEntryAmount } from "@/lib/entryDisplay";
import { isNilEntry, nilEntryTitle, NIL_DETAIL } from "@/lib/nilEntry";
import type { Entry } from "@/lib/types";
import { useUser } from "@/app/context/UserContext";

const REASON_CHIPS = ["Wrong entry", "Duplicate", "Typed by mistake"];

export default function DeleteEntrySheet({
  entry,
  onClose,
  onSuccess,
}: {
  entry: Entry;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { userName } = useUser();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nilDay = isNilEntry(entry);
  const title = nilDay ? nilEntryTitle(entry) : entry.name || entry.category || "Entry";
  const subtitle = nilDay
    ? `${formatDateDDMMYYYY(entry.date)} · ${NIL_DETAIL}`
    : `${formatDateDDMMYYYY(entry.date)} · ${formatEntryAmount(entry.amount, entry.type)}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || saving) return;

    setError("");
    setSaving(true);
    try {
      const res = await apiFetch(`/api/entries/${entry._id}/adjust`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), editedBy: userName || "User" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-[#0B4A8C]/40 backdrop-blur-sm nav-sheet-backdrop"
        aria-label="Close"
      />
      <div className="approve-sheet-enter fixed inset-x-0 bottom-0 z-[61] mx-auto max-w-lg rounded-t-3xl border-t border-[#D6E6F5] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-[#D6E6F5]" aria-hidden />
        <form onSubmit={handleSubmit} className="px-5 pt-4 pb-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">Delete entry</p>
                <h2 className="mt-0.5 truncate text-lg font-bold text-[#0B4A8C]">{title}</h2>
                <p className="mt-1 text-sm text-[#5A7FA5]">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[#7A9BB8] hover:bg-[#F4F8FC]"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="mb-3 text-xs font-medium text-[#5A7FA5]">Why are you deleting this?</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {REASON_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setReason(chip)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                  reason === chip
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-[#F8FBFE] text-[#0B4A8C] ring-[#D6E6F5]"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            required
            placeholder="Or type a reason"
            className="w-full resize-none rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-3 text-sm text-[#0B4A8C] outline-none placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]"
          />

          {error ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl bg-[#F4F8FC] py-3.5 text-sm font-bold text-[#0B4A8C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !reason.trim()}
              className="rounded-2xl bg-red-600 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

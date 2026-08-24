"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { formatEntryAmount } from "@/lib/entryDisplay";
import type { Entry } from "@/lib/types";
import { canUserModifyEntry, requestLabel } from "@/lib/paymentWorkflow";
import SearchableDropdown from "../ui/SearchableDropdown";
import { useUser } from "@/app/context/UserContext";

export default function ApproveOnSiteSheet({
  entry,
  onClose,
  onSuccess,
  onEditDetails,
}: {
  entry: Entry;
  onClose: () => void;
  onSuccess: () => void;
  onEditDetails?: () => void;
}) {
  const { userName } = useUser();
  const [approvedBy, setApprovedBy] = useState(entry.approvedBy || "");
  const [paymentDueDate, setPaymentDueDate] = useState(
    entry.paymentDueDate || new Date().toISOString().split("T")[0]
  );
  const [options, setOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const locked = !canUserModifyEntry(entry) || entry.approvalStatus !== "pending";

  const loadDefaults = useCallback(async () => {
    const res = await apiFetch("/api/defaults");
    if (res.ok) {
      const data = await res.json();
      setOptions(data.approverNames ?? []);
    }
  }, []);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (locked || !approvedBy.trim() || !paymentDueDate || saving || done) return;

    setError("");
    setSaving(true);
    try {
      const res = await apiFetch(`/api/entries/${entry._id}/approve-on-site`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedBy: approvedBy.trim(),
          paymentDueDate,
          editedBy: userName || approvedBy.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");

      setSaving(false);
      setDone(true);
      onSuccess();
      window.setTimeout(() => onClose(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const title = requestLabel(entry);

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
        <div className="px-5 pt-4 pb-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEF5FC] text-[#0B4A8C]">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
                  Approve on site
                </p>
                <h2 className="mt-0.5 truncate text-lg font-bold text-[#0B4A8C]">{title}</h2>
                <p className="mt-1 text-sm text-[#5A7FA5]">
                  {formatDateDDMMYYYY(entry.date)} · {formatEntryAmount(entry.amount, entry.type)}
                </p>
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

          {locked ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">Already moved to the next section</p>
              <p className="mt-1 text-xs text-amber-800">
                This entry is no longer pending approval. Close this and tap <strong>To pay</strong>{" "}
                or <strong>Paid</strong> on Track.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full rounded-2xl bg-[#0B4A8C] py-3.5 text-sm font-bold text-white"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] p-4">
                <div className="mb-2 flex items-center gap-2 text-[#0B4A8C]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Approved by</span>
                </div>
                <SearchableDropdown
                  hideLabel
                  value={approvedBy}
                  onChange={setApprovedBy}
                  options={options}
                  placeholder="Who approved this?"
                  addNewLabel="Add approver"
                  required
                  inputClassName="w-full min-h-[48px] rounded-xl border border-[#D6E6F5] bg-white px-3 py-3 text-base text-[#0B4A8C] outline-none focus:border-[#0B4A8C] [font-size:16px]"
                />
                <p className="mt-2 text-xs text-[#5A7FA5]">
                  After confirm, this card leaves Pending and appears under <strong>To pay</strong>.
                </p>
              </div>

              <div className="rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] p-4">
                <label className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#0B4A8C]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Payment date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  required
                  aria-label="Payment date"
                  className="w-full min-h-[48px] rounded-xl border border-[#D6E6F5] bg-white px-3 py-3 text-base text-[#0B4A8C] outline-none focus:border-[#0B4A8C] [font-size:16px]"
                />
                <p className="mt-2 text-xs text-[#5A7FA5]">
                  Which date will you pay <strong>{entry.name}</strong>? Admin will see this.
                </p>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || done || !approvedBy.trim() || !paymentDueDate}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-[0.99] disabled:opacity-60 ${
                  done ? "bg-emerald-600" : "bg-[#0B4A8C] hover:bg-[#083A6E]"
                }`}
              >
                {done ? (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Moved to To pay
                  </>
                ) : saving ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving 1 / 1
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm approval
                  </>
                )}
              </button>

              {onEditDetails && (
                <button
                  type="button"
                  onClick={onEditDetails}
                  className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-[#5A7FA5]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit amount or notes instead
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}

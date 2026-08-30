"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import type { Entry } from "@/lib/types";
import SearchableDropdown from "../ui/SearchableDropdown";
import DdMmYyyyDateInput from "../ui/DdMmYyyyDateInput";
import { useUser } from "@/app/context/UserContext";

export default function BulkApproveOnSiteSheet({
  entries,
  personName,
  date,
  onClose,
  onSuccess,
}: {
  entries: Entry[];
  personName: string;
  date: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { userName } = useUser();
  const [approvedBy, setApprovedBy] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [options, setOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const totalAmount = entries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const entryIds = entries.map((e) => e._id).filter((id): id is string => Boolean(id));

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
    if (!approvedBy.trim() || !paymentDueDate || saving || done || entryIds.length < 2) return;

    setError("");
    setSaving(true);
    try {
      const res = await apiFetch("/api/entries/bulk-approve-on-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds,
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
      window.setTimeout(() => onClose(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
        <div className="px-5 pt-4 pb-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
                Bulk approve on site
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-[#0B4A8C]">{personName}</h2>
              <p className="mt-1 text-sm text-[#5A7FA5]">
                {formatDateDDMMYYYY(date)} · {entries.length} entries · ₹
                {totalAmount.toLocaleString("en-IN")}
              </p>
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

          <div className="mb-4 max-h-32 overflow-y-auto rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] p-2">
            {entries.map((entry) => (
              <div
                key={entry._id}
                className="flex items-center justify-between gap-2 border-b border-[#E8F0F7] px-2 py-1.5 text-xs last:border-0"
              >
                <span className="truncate font-medium text-[#0B4A8C]">
                  {entry.category || entry.note || "Expense"}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-[#0B4A8C]">
                  ₹{Math.abs(entry.amount).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] p-4">
              <SearchableDropdown
                hideLabel
                leadingIcon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                }
                label="Approved by"
                value={approvedBy}
                onChange={setApprovedBy}
                options={options}
                placeholder="Who approved all?"
                addNewLabel="Add approver"
                required
                inputClassName="w-full min-h-[48px] rounded-xl border border-[#D6E6F5] bg-white px-3 py-3 text-base text-[#0B4A8C] outline-none focus:border-[#0B4A8C] [font-size:16px]"
              />
            </div>

            <div className="rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] p-4">
              <DdMmYyyyDateInput
                value={paymentDueDate}
                onChange={setPaymentDueDate}
                required
                ariaLabel="Payment date for all entries"
              />
              <p className="mt-2 text-xs text-[#5A7FA5]">
                Same approver and pay date for all {entries.length} entries.
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
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white disabled:opacity-60 ${
                done ? "bg-emerald-600" : "bg-[#0B4A8C] hover:bg-[#083A6E]"
              }`}
            >
              {done ? (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {entries.length} moved to To pay
                </>
              ) : saving ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Approving {entries.length}…
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Approve all {entries.length}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

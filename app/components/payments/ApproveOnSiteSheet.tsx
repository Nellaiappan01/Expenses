"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { formatEntryAmount } from "@/lib/entryDisplay";
import type { Entry } from "@/lib/types";
import { requestLabel } from "@/lib/paymentWorkflow";
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
    if (!approvedBy.trim() || !paymentDueDate || saving || done) return;

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
      window.setTimeout(() => onClose(), 900);
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
      <div className="approve-sheet-enter fixed inset-x-0 bottom-0 z-[61] mx-auto max-w-md rounded-t-3xl border-t border-[#D6E6F5] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[#D6E6F5]" aria-hidden />
        <div className="px-5 pt-4 pb-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
                Approved on site
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-[#0B4A8C]">{title}</h2>
              <p className="mt-1 text-sm text-[#5A7FA5]">
                {formatDateDDMMYYYY(entry.date)} · {formatEntryAmount(entry.amount, entry.type)}
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

          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] p-4">
              <SearchableDropdown
                label="Approved by"
                value={approvedBy}
                onChange={setApprovedBy}
                options={options}
                placeholder="Who approved this?"
                addNewLabel="Add approver"
                required
                inputClassName="w-full min-h-[48px] rounded-xl border border-[#D6E6F5] bg-white px-3 py-3 text-base text-[#0B4A8C] outline-none focus:border-[#0B4A8C] [font-size:16px]"
                labelClassName="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]"
              />
              <p className="mt-2 text-xs text-[#5A7FA5]">
                Sends to admin for payment. Status updates to{" "}
                <strong>Payment Pending</strong> until admin marks paid.
              </p>
            </div>

            <div className="rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] p-4">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
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
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || done || !approvedBy.trim() || !paymentDueDate}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-[0.99] disabled:opacity-60 ${
                done ? "salt-save-btn-success bg-emerald-600" : "bg-[#0B4A8C] hover:bg-[#083A6E]"
              }`}
            >
              {done ? (
                <>
                  <svg
                    className="salt-save-check h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Sent for payment
                </>
              ) : saving ? (
                "Saving…"
              ) : (
                "Confirm approval"
              )}
            </button>

            {onEditDetails && (
              <button
                type="button"
                onClick={onEditDetails}
                className="w-full py-2 text-center text-sm font-medium text-[#5A7FA5] underline-offset-2 hover:underline"
              >
                Edit amount or notes instead
              </button>
            )}
          </form>
        </div>
      </div>
    </>
  );
}

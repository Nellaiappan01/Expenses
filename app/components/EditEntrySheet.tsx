"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { Entry, PaymentMethod } from "@/lib/types";
import { useUser } from "../context/UserContext";

export function EditIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function EditEntrySheet({
  entry,
  bankOptions,
  onClose,
  onSuccess,
}: {
  entry: Entry;
  bankOptions: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { userName } = useUser();
  const [name, setName] = useState(entry.name);
  const [amount, setAmount] = useState(String(Math.abs(entry.amount)));
  const [method, setMethod] = useState<PaymentMethod>(entry.method);
  const [bankName, setBankName] = useState(entry.bankName || "");
  const [date, setDate] = useState(entry.date);
  const [category, setCategory] = useState(entry.category || "");
  const [note, setNote] = useState(entry.note || "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(entry.name);
    setAmount(String(Math.abs(entry.amount)));
    setMethod(entry.method);
    setBankName(entry.bankName || "");
    setDate(entry.date);
    setCategory(entry.category || "");
    setNote(entry.note || "");
    setReason("");
  }, [entry]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Reason is required for adjustments");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const numAmount = Number(amount);
      const signedAmount =
        entry.type === "worker_payment" || entry.type === "expense"
          ? -Math.abs(numAmount)
          : entry.amount >= 0
            ? Math.abs(numAmount)
            : -Math.abs(numAmount);

      const payload: Record<string, unknown> = {
        reason: reason.trim(),
        editedBy: userName || "User",
      };
      if (name.trim() !== entry.name) payload.name = name.trim();
      if (signedAmount !== entry.amount) payload.amount = signedAmount;
      if (method !== entry.method) payload.method = method;
      if (date !== entry.date) payload.date = date;
      if ((category.trim() || "") !== (entry.category ?? "")) payload.category = category.trim();
      if ((note.trim() || "") !== (entry.note ?? "")) payload.note = note.trim();
      if (method === "Bank" && bankName.trim() !== (entry.bankName ?? "")) {
        payload.bankName = bankName.trim();
      }

      const { reason: _r, editedBy: _e, ...changes } = payload;
      if (Object.keys(changes).length === 0) {
        setError("No changes to save");
        setSaving(false);
        return;
      }

      const res = await apiFetch(`/api/entries/${entry._id}/adjust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm nav-sheet-backdrop"
        aria-label="Close"
      />
      <div className="nav-sheet fixed inset-x-0 bottom-0 z-[61] max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mx-auto max-w-md px-4 pt-3 pb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Adjust Entry
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(entry.type === "worker_payment" || entry.type === "expense") && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {entry.type === "worker_payment" ? "Worker name" : "Name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            )}

            {entry.type === "worker_payment" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Amount
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                required
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Payment method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Cash", "GPay", "Bank"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                      method === m
                        ? "bg-amber-500 text-white"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {method === "Bank" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Bank
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Select bank</option>
                  {bankOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
              <label className="mb-1 block text-sm font-medium text-amber-800 dark:text-amber-200">
                Reason for adjustment <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this being changed?"
                required
                className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm dark:border-amber-800 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-amber-500 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

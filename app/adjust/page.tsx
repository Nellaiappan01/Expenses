"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY, toDateInputValue } from "@/lib/dateFormat";
import { normalizeStoredAmount } from "@/lib/entryAmount";
import { entryAmountColorClass, formatEntryAmount } from "@/lib/entryDisplay";
import type { Entry, PaymentMethod } from "@/lib/types";
import {
  canUserModifyEntry,
  entryLockShortLabel,
  entryModifyLockReason,
} from "@/lib/paymentWorkflow";
import {
  amountInputClass,
  btnDeleteClass,
  btnSaveClass,
  inputClassSm,
  labelClass,
} from "@/lib/uiClasses";
import WalletPaymentToggle from "../components/ui/WalletPaymentToggle";
import SearchableDropdown from "../components/ui/SearchableDropdown";
import { useConfig } from "../context/ConfigContext";
import { useUser } from "../context/UserContext";

function entrySummary(entry: Entry) {
  const parts = [formatDateDDMMYYYY(entry.date), entry.method];
  if (entry.category) parts.push(entry.category);
  return parts.join(" · ");
}

function sheetsSyncMessage(status?: string, error?: string | null) {
  if (status === "synced") return "Google Sheet updated.";
  if (status === "failed") {
    return error
      ? `Saved in app. Sheet sync failed: ${error}`
      : "Saved in app. Google Sheet sync failed — redeploy Apps Script from Settings.";
  }
  return "Saved in app.";
}

export default function AdjustPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const { userName } = useUser();
  const feedbackRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Entry[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [expenseCategoryOptions, setExpenseCategoryOptions] = useState<string[]>([]);
  const [workerCategoryOptions, setWorkerCategoryOptions] = useState<string[]>([]);
  const [requestedByOptions, setRequestedByOptions] = useState<string[]>([]);
  const [workerOptions, setWorkerOptions] = useState<string[]>([]);
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([]);
  const [bankOptions, setBankOptions] = useState<string[]>([]);
  const [bankName, setBankName] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasLedger = features.expenses || features.workers;
    if (config && !hasLedger) {
      router.replace(features.stock ? "/stock" : "/");
    }
  }, [config, router]);

  const loadDefaults = useCallback(async () => {
    const [defaultsRes, namesRes] = await Promise.all([
      apiFetch("/api/defaults"),
      apiFetch("/api/worker-history/names"),
    ]);
    if (defaultsRes.ok) {
      const data = await defaultsRes.json();
      setExpenseCategoryOptions(data.expenseCategories ?? []);
      setWorkerCategoryOptions(data.workerCategories ?? []);
      setRequestedByOptions(data.expenseNames ?? []);
      setApprovedByOptions(data.approverNames ?? []);
      setBankOptions(data.banks ?? []);
    }
    if (namesRes.ok) {
      const names = await namesRes.json();
      setWorkerOptions((names ?? []).map((n: { name: string }) => n.name));
    }
  }, []);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults]);

  useEffect(() => {
    if (!error && !success) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error, success]);

  function showFeedback(message: string, isError = false) {
    if (isError) {
      setSuccess("");
      setError(message);
    } else {
      setError("");
      setSuccess(message);
    }
  }

  function populateForm(entry: Entry) {
    setSelected(entry);
    setName(entry.name);
    setCategory(entry.category ?? "");
    setApprovedBy(entry.approvedBy ?? "");
    setAmount(String(Math.abs(entry.amount)));
    setMethod(entry.method);
    setNote(entry.note ?? "");
    setDate(toDateInputValue(entry.date));
    setBankName(entry.bankName ?? "");
    setReason("");
    setError("");
    setSuccess("");
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({ search: q, limit: "20", page: "1" });
      const res = await apiFetch(`/api/track/entries?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.entries ?? []);
      if ((data.entries ?? []).length === 0) {
        showFeedback("No entries found. Try a different search.", true);
      }
    } catch {
      showFeedback("Could not search entries", true);
    } finally {
      setSearching(false);
    }
  }

  function buildPatchPayload() {
    if (!selected) return null;

    const payload: Record<string, unknown> = {
      reason: reason.trim(),
      editedBy: userName || "User",
    };

    const numAmount = Number(amount);
    const normalizedAmount = normalizeStoredAmount(selected.type, numAmount);

    if (name.trim() !== selected.name) payload.name = name.trim();
    if ((category.trim() || "") !== (selected.category ?? "")) {
      payload.category = category.trim();
    }
    if (normalizedAmount !== selected.amount) payload.amount = normalizedAmount;
    if (method !== selected.method) payload.method = method;
    if (date && date !== toDateInputValue(selected.date)) payload.date = date;
    if ((note.trim() || "") !== (selected.note ?? "")) payload.note = note.trim();
    if (method === "Bank" && bankName.trim() !== (selected.bankName ?? "")) {
      payload.bankName = bankName.trim();
    }
    if (
      selected.type === "expense" &&
      selected.approvalStatus === "pending" &&
      (approvedBy.trim() || "") !== (selected.approvedBy ?? "")
    ) {
      payload.approvedBy = approvedBy.trim();
    }
    if (
      selected.type === "expense" &&
      !selected.approvalStatus &&
      (approvedBy.trim() || "") !== (selected.approvedBy ?? "")
    ) {
      payload.approvedBy = approvedBy.trim();
    }

    return payload;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || saving) return;

    if (!date) {
      showFeedback("Entry date is required.", true);
      return;
    }

    if (!reason.trim()) {
      showFeedback("Please fill in Reason — it is required for every adjustment.", true);
      return;
    }

    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      showFeedback("Enter a valid amount", true);
      return;
    }
    if (selected.type === "worker_payment" && !name.trim()) {
      showFeedback("Worker name is required", true);
      return;
    }
    if (selected.type === "expense" && !name.trim()) {
      showFeedback("Requested by is required", true);
      return;
    }
    if (
      (selected.type === "expense" || selected.type === "worker_payment") &&
      !category.trim()
    ) {
      showFeedback("Category is required", true);
      return;
    }
    if (selected.type === "expense" && !approvedBy.trim()) {
      showFeedback("Approved by is required", true);
      return;
    }
    if (method === "Bank" && !bankName.trim()) {
      showFeedback("Select a bank", true);
      return;
    }

    const payload = buildPatchPayload();
    if (!payload) return;

    const { reason: _r, editedBy: _e, ...changes } = payload;
    if (Object.keys(changes).length === 0) {
      showFeedback("No changes to save — edit a field first.", true);
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await apiFetch(`/api/entries/${selected._id}/adjust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save adjustment");
      }

      const sheetNote = sheetsSyncMessage(data.sheetsSyncStatus, data.sheetsSyncError);
      showFeedback(`Saved! ${sheetNote} Returning to home…`);
      setSearchResults((prev) => prev.map((e) => (e._id === data._id ? data : e)));

      setTimeout(() => router.push("/"), 1800);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Something went wrong", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected || deleting) return;
    if (!reason.trim()) {
      showFeedback("Please fill in Reason before deleting.", true);
      return;
    }
    if (!confirm(`Delete "${selected.name}" (${formatEntryAmount(selected.amount, selected.type)})?`)) {
      return;
    }

    setError("");
    setSuccess("");
    setDeleting(true);

    try {
      const res = await apiFetch(`/api/entries/${selected._id}/adjust`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          editedBy: userName || "User",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete");
      }

      const sheetNote = sheetsSyncMessage(data.sheetsSyncStatus, data.sheetsSyncError);
      showFeedback(`Deleted. ${sheetNote} Returning to home…`);
      setSearchResults((prev) => prev.filter((e) => e._id !== selected._id));
      setSelected(null);

      setTimeout(() => router.push("/"), 1800);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Something went wrong", true);
    } finally {
      setDeleting(false);
    }
  }

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers) return null;

  const isExpense = selected?.type === "expense";
  const isWorker = selected?.type === "worker_payment";
  const showName = isExpense || isWorker;
  const showCategory = isExpense || isWorker;
  const categoryOptions = isExpense ? expenseCategoryOptions : workerCategoryOptions;
  const nameOptions = isExpense ? requestedByOptions : workerOptions;
  const isWorkflowExpense =
    selected?.type === "expense" && !!(selected.approvalStatus || selected.paymentStatus);
  const entryLocked = selected ? !canUserModifyEntry(selected) : false;
  const lockReason = selected ? entryModifyLockReason(selected) : null;

  return (
    <div className="min-h-screen bg-[#F4F8FC]">
      <div className="mx-auto max-w-md px-3 py-4 pb-12 sm:px-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D6E4F0] bg-white text-[#5A6B7D] hover:bg-[#F8FBFF]"
            aria-label="Back to home"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#1A2B3C]">Adjust Entry</h1>
            <p className="text-sm text-[#5A6B7D]">Search, edit, or delete with audit trail</p>
          </div>
        </header>

        <form
          onSubmit={handleSearch}
          className="mb-4 space-y-2 rounded-2xl border border-[#D6E4F0] bg-white p-4 shadow-sm"
        >
          <label htmlFor="adjust-search" className={labelClass}>
            Search entry
          </label>
          <div className="flex gap-2">
            <input
              id="adjust-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, note, or keyword…"
              className={inputClassSm}
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="shrink-0 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {searching ? "…" : "Go"}
            </button>
          </div>
        </form>

        {searchResults.length > 0 && !selected && (
          <div className="mb-4 space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-[#5A6B7D]">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>
            {searchResults.map((entry) => {
              const lockHint = entryLockShortLabel(entry);
              return (
              <button
                key={entry._id}
                type="button"
                onClick={() => populateForm(entry)}
                className="flex w-full items-center justify-between rounded-xl border border-[#D6E4F0] bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#93C5FD] hover:bg-[#EFF6FF] active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[#1A2B3C]">{entry.name}</p>
                  <p className="mt-0.5 text-xs text-[#5A6B7D]">{entrySummary(entry)}</p>
                  {lockHint ? (
                    <p className="mt-1 text-[10px] font-semibold text-amber-800">{lockHint}</p>
                  ) : (
                    <p className="mt-1 text-[10px] font-medium text-[#2563EB]">
                      Tap to change date, amount, or other details
                    </p>
                  )}
                </div>
                <p
                  className={`ml-3 shrink-0 font-semibold tabular-nums ${entryAmountColorClass(entry)}`}
                >
                  {formatEntryAmount(entry.amount, entry.type)}
                </p>
              </button>
              );
            })}
          </div>
        )}

        {selected && (
          <form onSubmit={handleSave} className="form-enter space-y-4 rounded-2xl border border-[#D6E4F0] bg-white p-4 shadow-sm">
            <div ref={feedbackRef} className="space-y-2">
              {error && (
                <div
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div
                  className="success-enter flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
                  role="status"
                >
                  <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{success}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                  Editing
                </p>
                <p className="truncate font-medium text-[#1A2B3C]">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setError("");
                  setSuccess("");
                }}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-[#5A6B7D] hover:bg-[#F4F8FC]"
              >
                Change
              </button>
            </div>

            {entryLocked && lockReason && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">
                  {selected.paymentStatus === "paid"
                    ? "Paid / verified — cannot edit"
                    : selected.approvalStatus === "rejected"
                      ? "Rejected — cannot edit"
                      : "Waiting for admin payment — cannot edit"}
                </p>
                <p className="mt-0.5 text-xs leading-snug">{lockReason}</p>
              </div>
            )}

            {showName && (
              <SearchableDropdown
                label={isExpense ? "Requested by" : "Worker"}
                value={name}
                onChange={setName}
                options={nameOptions}
                placeholder={isExpense ? "Who requested…" : "Worker name…"}
                addNewLabel="Use this name"
                required
              />
            )}

            {showCategory && (
              <SearchableDropdown
                label="Category"
                value={category}
                onChange={setCategory}
                options={categoryOptions}
                placeholder="Category…"
                addNewLabel="Use this category"
                required
              />
            )}

            {isExpense && isWorkflowExpense && selected?.approvalStatus === "pending" && (
              <SearchableDropdown
                label="Approved by"
                value={approvedBy}
                onChange={setApprovedBy}
                options={approvedByOptions}
                placeholder="Who approved on site?"
                addNewLabel="Use this name"
              />
            )}

            {isExpense && !isWorkflowExpense && (
              <SearchableDropdown
                label="Approved by"
                value={approvedBy}
                onChange={setApprovedBy}
                options={approvedByOptions}
                placeholder="Approver…"
                addNewLabel="Use this name"
                required
              />
            )}

            <div>
              <label htmlFor="adjust-date" className={labelClass}>
                Entry date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="adjust-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={entryLocked}
                  className={`${inputClassSm} pr-11 ${entryLocked ? "bg-[#F4F8FC] text-[#5A6B7D]" : ""}`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6B7D]" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#5A6B7D]">
                {entryLocked
                  ? "Date cannot be changed on paid or approved entries."
                  : "Tap the date to pick a different day."}
              </p>
            </div>

            <div>
              <label htmlFor="adjust-amount" className={labelClass}>
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="adjust-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                required
                disabled={entryLocked}
                className={amountInputClass}
              />
            </div>

            <WalletPaymentToggle value={method} onChange={setMethod} disabled={entryLocked} />

            {method === "Bank" && (
              <div>
                <label htmlFor="adjust-bank" className={labelClass}>
                  Bank <span className="text-red-500">*</span>
                </label>
                <select
                  id="adjust-bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  disabled={entryLocked}
                  className={inputClassSm}
                >
                  <option value="">Select bank</option>
                  {bankOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="adjust-note" className={labelClass}>
                Note
              </label>
              <input
                id="adjust-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note…"
                disabled={entryLocked}
                className={inputClassSm}
              />
            </div>

            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
              <label htmlFor="adjust-reason" className={labelClass}>
                Reason <span className="text-red-500">*</span>
              </label>
              <input
                id="adjust-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this being changed?"
                required
                className={inputClassSm}
              />
              <p className="mt-1.5 text-xs text-amber-800">
                Required — without this, Save will not work.
              </p>
            </div>

            <button type="submit" disabled={saving || deleting || entryLocked} className={btnSaveClass}>
              {saving ? "Saving…" : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving || entryLocked}
              className={btnDeleteClass}
            >
              {deleting ? "Deleting…" : "Delete Entry"}
            </button>
          </form>
        )}

        {!selected && searchResults.length === 0 && !error && (
          <p className="px-1 text-center text-sm text-[#5A6B7D]">
            Search for an entry above to edit or delete it.
          </p>
        )}

        {error && !selected && (
          <p className="px-1 text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

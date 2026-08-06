"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import type { Entry, PaymentMethod } from "@/lib/types";
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

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function entrySummary(entry: Entry) {
  const parts = [formatDateDDMMYYYY(entry.date), entry.method];
  if (entry.category) parts.push(entry.category);
  return parts.join(" · ");
}

export default function AdjustPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const { userName } = useUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Entry[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [workerOptions, setWorkerOptions] = useState<string[]>([]);
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
      setCategoryOptions(data.workerCategories ?? []);
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
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  function populateForm(entry: Entry) {
    setSelected(entry);
    setName(entry.name);
    setCategory(entry.category ?? "");
    setAmount(String(Math.abs(entry.amount)));
    setMethod(entry.method);
    setNote(entry.note ?? "");
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
        setError("No entries found. Try a different search.");
      }
    } catch {
      setError("Could not search entries");
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
    const signedAmount =
      selected.type === "worker_payment" || selected.type === "expense"
        ? -Math.abs(numAmount)
        : selected.amount >= 0
          ? Math.abs(numAmount)
          : -Math.abs(numAmount);

    if (name.trim() !== selected.name) payload.name = name.trim();
    if ((category.trim() || "") !== (selected.category ?? "")) {
      payload.category = category.trim();
    }
    if (signedAmount !== selected.amount) payload.amount = signedAmount;
    if (method !== selected.method) payload.method = method;
    if ((note.trim() || "") !== (selected.note ?? "")) payload.note = note.trim();
    if (method === "Bank" && bankName.trim() !== (selected.bankName ?? "")) {
      payload.bankName = bankName.trim();
    }

    return payload;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || saving) return;

    if (!reason.trim()) {
      setError("Reason is required for every adjustment");
      return;
    }

    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (selected.type === "worker_payment" && !name.trim()) {
      setError("Worker name is required");
      return;
    }
    if (method === "Bank" && !bankName.trim()) {
      setError("Select a bank");
      return;
    }

    const payload = buildPatchPayload();
    if (!payload) return;

    const { reason: _r, editedBy: _e, ...changes } = payload;
    if (Object.keys(changes).length === 0) {
      setError("No changes to save");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const res = await apiFetch(`/api/entries/${selected._id}/adjust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save adjustment");
      }
      const updated = await res.json();
      setSuccess("Entry updated — audit log recorded");
      populateForm(updated);
      setSearchResults((prev) =>
        prev.map((e) => (e._id === updated._id ? updated : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected || deleting) return;
    if (!reason.trim()) {
      setError("Reason is required before deleting");
      return;
    }
    if (!confirm(`Delete "${selected.name}" (${formatAmount(selected.amount)})?`)) return;

    setError("");
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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      setSuccess("Entry deleted — audit log recorded");
      setSelected(null);
      setSearchResults((prev) => prev.filter((e) => e._id !== selected._id));
      setName("");
      setCategory("");
      setAmount("");
      setNote("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers) return null;

  const showWorker = selected?.type === "worker_payment" || selected?.type === "expense";
  const showCategory = selected?.type === "worker_payment";

  return (
    <div className="min-h-screen bg-zinc-100">
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
            <h1 className="text-xl font-bold text-zinc-900">Adjust Entry</h1>
            <p className="text-sm text-zinc-500">Search, edit, or delete with audit trail</p>
          </div>
        </header>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="mb-4 space-y-2 rounded-2xl bg-white p-4 shadow-sm"
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
              placeholder="Worker name, note, or keyword…"
              className={inputClassSm}
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="shrink-0 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {searching ? "…" : "Go"}
            </button>
          </div>
        </form>

        {/* Results */}
        {searchResults.length > 0 && !selected && (
          <div className="mb-4 space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>
            {searchResults.map((entry) => (
              <button
                key={entry._id}
                type="button"
                onClick={() => populateForm(entry)}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/50 active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900">{entry.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{entrySummary(entry)}</p>
                </div>
                <p
                  className={`ml-3 shrink-0 font-semibold tabular-nums ${
                    entry.amount >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatAmount(entry.amount)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Edit form */}
        {selected && (
          <form onSubmit={handleSave} className="form-enter space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                  Editing
                </p>
                <p className="truncate font-medium text-zinc-900">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setError("");
                }}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
              >
                Change
              </button>
            </div>

            {showWorker && (
              <SearchableDropdown
                label="Worker"
                value={name}
                onChange={setName}
                options={workerOptions}
                placeholder="Worker name…"
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
                className={amountInputClass}
              />
            </div>

            <WalletPaymentToggle value={method} onChange={setMethod} />

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
                className={inputClassSm}
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
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
              <p className="mt-1.5 text-xs text-amber-700">
                Required for audit log — records original value, new value, editor, and time.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            {success && (
              <div
                className="success-enter flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700"
                role="status"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            )}

            <button type="submit" disabled={saving} className={btnSaveClass}>
              {saving ? "Saving…" : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={btnDeleteClass}
            >
              {deleting ? "Deleting…" : "Delete Entry"}
            </button>
          </form>
        )}

        {!selected && searchResults.length === 0 && !error && (
          <p className="px-1 text-center text-sm text-zinc-500">
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

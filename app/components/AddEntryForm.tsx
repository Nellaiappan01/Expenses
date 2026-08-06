"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { PaymentMethod } from "@/lib/types";
import DateField from "./ui/DateField";
import PaymentMethodToggle from "./ui/PaymentMethodToggle";
import SearchableDropdown from "./ui/SearchableDropdown";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function AddEntryForm({
  onSuccess,
  refreshTrigger = 0,
}: {
  onSuccess?: () => void;
  refreshTrigger?: number;
}) {
  const [workerName, setWorkerName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO);
  const [workerOptions, setWorkerOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const workerRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  const loadDefaults = useCallback(async () => {
    const [defaultsRes, namesRes] = await Promise.all([
      apiFetch("/api/defaults"),
      apiFetch("/api/worker-history/names"),
    ]);

    const defaults = defaultsRes.ok
      ? await defaultsRes.json()
      : { workerNames: [], workerCategories: [] };
    const namesFromEntries = namesRes.ok ? await namesRes.json() : [];

    const workerFromDefaults = (defaults.workerNames ?? []) as string[];
    const workerFromEntries = (namesFromEntries ?? []).map(
      (n: { name: string }) => n.name
    );
    const seen = new Set<string>();
    const workers: string[] = [];
    for (const n of [...workerFromDefaults, ...workerFromEntries]) {
      const trimmed = String(n).trim();
      const key = trimmed.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        workers.push(trimmed);
      }
    }
    setWorkerOptions(workers.sort((a, b) => a.localeCompare(b)));
    setCategoryOptions(defaults.workerCategories ?? []);
  }, []);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults, refreshTrigger]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  function resetForm(keepMethod: PaymentMethod) {
    setWorkerName("");
    setCategory("");
    setAmount("");
    setNote("");
    setDate(todayISO());
    setMethod(keepMethod);
    setError("");
    requestAnimationFrame(() => workerRef.current?.focus());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedName = workerName.trim();
    const trimmedCategory = category.trim();
    const numAmount = Number(amount);

    if (!trimmedName) {
      setError("Worker name is required");
      workerRef.current?.focus();
      return;
    }
    if (!trimmedCategory) {
      setError("Category is required");
      categoryRef.current?.focus();
      return;
    }
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      amountRef.current?.focus();
      return;
    }

    setError("");
    setSaving(true);

    try {
      const res = await apiFetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "worker_payment",
          name: trimmedName,
          category: trimmedCategory,
          amount: numAmount,
          method,
          date,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const savedMethod = method;
      resetForm(savedMethod);
      setSuccess(true);
      onSuccess?.();
      loadDefaults();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="form-enter rounded-2xl bg-white p-3 shadow-sm sm:p-4"
    >
      <div className="space-y-3">
        <DateField
          value={date}
          onChange={setDate}
          onEnter={() => workerRef.current?.focus()}
        />

        <SearchableDropdown
          label="Worker"
          value={workerName}
          onChange={setWorkerName}
          options={workerOptions}
          placeholder="Search or type name…"
          addNewLabel="Add New Worker"
          required
          inputRef={workerRef}
          onEnter={() => categoryRef.current?.focus()}
        />

        <SearchableDropdown
          label="Category"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          placeholder="Search category…"
          addNewLabel="Add New Category"
          required
          inputRef={categoryRef}
          onEnter={() => amountRef.current?.focus()}
        />

        <div>
          <label
            htmlFor="amount"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Amount <span className="text-red-500">*</span>
          </label>
          <input
            ref={amountRef}
            id="amount"
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                noteRef.current?.focus();
              }
            }}
            placeholder="₹ 0"
            required
            className="w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-xl font-semibold tabular-nums text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:bg-zinc-50 focus:ring-2 focus:ring-emerald-500/30 [font-size:16px]"
          />
        </div>

        <PaymentMethodToggle value={method} onChange={setMethod} />

        <div>
          <label
            htmlFor="note"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Note <span className="font-normal normal-case text-zinc-400">(optional)</span>
          </label>
          <input
            ref={noteRef}
            id="note"
            type="text"
            enterKeyHint="done"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            className="w-full rounded-xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:bg-zinc-50 focus:ring-2 focus:ring-emerald-500/30 [font-size:16px]"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {success && (
          <div
            className="success-enter flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700"
            role="status"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Entry saved successfully
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white transition-all duration-200 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Entry"}
        </button>
      </div>
    </form>
  );
}

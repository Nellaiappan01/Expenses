"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { EntryType, PaymentMethod } from "@/lib/types";

export default function AddEntryForm({
  onSuccess,
  refreshTrigger = 0,
}: {
  onSuccess?: () => void;
  refreshTrigger?: number;
}) {
  const [type, setType] = useState<EntryType>("expense");
  const [name, setName] = useState("");
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [noteOptions, setNoteOptions] = useState<string[]>([]);
  const [bankOptions, setBankOptions] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [bankName, setBankName] = useState("");
  const [sender, setSender] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/defaults").then((r) => (r.ok ? r.json() : { names: [] })),
      apiFetch("/api/worker-history/names").then((r) => (r.ok ? r.json() : [])),
    ]).then(([defaults, namesFromEntries]) => {
      const fromDefaults = defaults.names ?? [];
      const fromEntries = (namesFromEntries ?? []).map((n: { name: string }) => n.name);
      const seen = new Set<string>();
      const combined: string[] = [];
      for (const n of [...fromDefaults, ...fromEntries]) {
        const key = String(n).trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          combined.push(String(n).trim());
        }
      }
      setNameOptions(combined.sort((a, b) => a.localeCompare(b)));
      setNoteOptions(defaults.notes ?? []);
      setBankOptions(defaults.banks ?? []);
    });
  }, [refreshTrigger]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await apiFetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: type === "rotation_cash" ? (sender.trim() || "Wallet") : type === "adjustment" ? (note.trim() || "Adjustment") : name.trim(),
          amount: Number(amount),
          method,
          date,
          note: note.trim() || undefined,
          bankName: bankName.trim() || undefined,
          sender: sender.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setName("");
      setAmount("");
      setNote("");
      setBankName("");
      setSender("");
      setType("expense");
      setMethod("Cash");
      setDate(new Date().toISOString().split("T")[0]);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
    >
      <div className="space-y-4">
        <div className="grid w-full grid-cols-4 gap-1.5">
          {(["expense", "worker_payment", "adjustment", "rotation_cash"] as const).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    if (t === "rotation_cash") {
                      if (method === "GPay") setMethod("Cash");
                    } else {
                      setBankName("");
                      setSender("");
                      if (method === "Bank") setMethod("Cash");
                    }
                  }}
                  className={`min-w-0 rounded-xl px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:py-3 sm:text-sm ${
                    type === t
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  }`}
                >
                  {t === "rotation_cash" ? "Wallet" : t === "worker_payment" ? "Worker" : t === "adjustment" ? "Adjust" : "Expense"}
                </button>
              )
            )}
        </div>

        {type === "expense" && (
          <div>
            <input
              id="name"
              type="text"
              list="name-list"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (select or type new)"
              required
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <datalist id="name-list">
              {nameOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>
        )}

        {type === "worker_payment" && (
          <div>
            <input
              id="name"
              type="text"
              list="name-list"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Worker name (select or type)"
              required
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <datalist id="name-list">
              {nameOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>
        )}

        {type === "rotation_cash" && (
          <div>
            <input
              id="sender"
              type="text"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="Who sent"
              required
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>
        )}

        <div>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.-]/g, ""))}
            placeholder={type === "adjustment" ? "Amount (+ to add, - to subtract)" : "Amount"}
            required
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 [font-size:16px]"
          />
        </div>

        {type !== "adjustment" && (
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {type === "rotation_cash" ? "Received" : "Method"}
          </label>
          {type === "rotation_cash" ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("Cash")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  method === "Cash"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                }`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setMethod("Bank")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  method === "Bank"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                }`}
              >
                Bank
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("Cash")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  method === "Cash"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                }`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setMethod("GPay")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  method === "GPay"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                }`}
              >
                GPay
              </button>
            </div>
          )}
        </div>
        )}

        {type === "adjustment" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              Balance correction. Use + amount to add, - amount to subtract.
            </p>
          </div>
        )}

        {type === "rotation_cash" && method === "Bank" && (
              <div>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Select bank</option>
                  {bankOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {bankOptions.length === 0 && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Add banks in Defaults
                  </p>
                )}
              </div>
        )}

        <div>
          <input
            id="note"
            type="text"
            list="note-list"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={type === "adjustment" ? "Reason for adjustment (required)" : "Note"}
            required={type === "adjustment"}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <datalist id="note-list">
            {noteOptions.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
          {noteOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {noteOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setNote(opt)}
                  className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="date"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-zinc-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

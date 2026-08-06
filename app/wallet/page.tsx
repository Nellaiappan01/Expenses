"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { PaymentMethod } from "@/lib/types";
import {
  amountInputClass,
  btnSaveClass,
  inputClassSm,
  labelClass,
} from "@/lib/uiClasses";
import DateField from "../components/ui/DateField";
import WalletPaymentToggle from "../components/ui/WalletPaymentToggle";
import { useConfig } from "../context/ConfigContext";

type WalletAction = "add" | "withdraw";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function WalletPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [action, setAction] = useState<WalletAction>("add");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [bankName, setBankName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO);
  const [bankOptions, setBankOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasLedger = features.expenses || features.workers;
    if (config && !hasLedger) {
      router.replace(features.stock ? "/stock" : "/");
    }
  }, [config, router]);

  const loadDefaults = useCallback(async () => {
    const res = await apiFetch("/api/defaults");
    if (res.ok) {
      const data = await res.json();
      setBankOptions(data.banks ?? []);
    }
  }, []);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (method === "Bank" && !bankName.trim()) {
      setError("Select a bank");
      return;
    }

    setError("");
    setSaving(true);

    const signedAmount = action === "withdraw" ? -numAmount : numAmount;
    const entryName = action === "add" ? "Wallet Add" : "Wallet Withdraw";

    try {
      const res = await apiFetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rotation_cash",
          name: entryName,
          amount: signedAmount,
          method,
          date,
          note: note.trim() || undefined,
          bankName: method === "Bank" ? bankName.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setAmount("");
      setNote("");
      setDate(todayISO());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  if (config && !features.expenses && !features.workers) return null;

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
            <h1 className="text-xl font-bold text-zinc-900">Wallet</h1>
            <p className="text-sm text-zinc-500">Add or withdraw cash</p>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="form-enter space-y-4 rounded-2xl bg-white p-4 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction("add")}
              className={`rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                action === "add"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                  : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              Add Money
            </button>
            <button
              type="button"
              onClick={() => setAction("withdraw")}
              className={`rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                action === "withdraw"
                  ? "bg-red-600 text-white shadow-sm shadow-red-600/25"
                  : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              Withdraw Money
            </button>
          </div>

          <div>
            <label htmlFor="wallet-amount" className={labelClass}>
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              id="wallet-amount"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="₹ 0"
              required
              className={amountInputClass}
            />
          </div>

          <WalletPaymentToggle value={method} onChange={setMethod} />

          {method === "Bank" && (
            <div>
              <label htmlFor="wallet-bank" className={labelClass}>
                Bank <span className="text-red-500">*</span>
              </label>
              <select
                id="wallet-bank"
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
            <label htmlFor="wallet-note" className={labelClass}>
              Note{" "}
              <span className="font-normal normal-case text-zinc-400">(optional)</span>
            </label>
            <input
              id="wallet-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              className={inputClassSm}
            />
          </div>

          <DateField value={date} onChange={setDate} />

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
              Wallet transaction saved
            </div>
          )}

          <button type="submit" disabled={saving} className={btnSaveClass}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

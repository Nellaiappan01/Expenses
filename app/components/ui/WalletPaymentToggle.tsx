"use client";

import type { PaymentMethod } from "@/lib/types";

type WalletPaymentToggleProps = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
};

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "Cash", label: "Cash" },
  { id: "GPay", label: "GPay" },
  { id: "Bank", label: "Bank" },
];

export default function WalletPaymentToggle({ value, onChange, disabled }: WalletPaymentToggleProps) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Payment Method
      </p>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
              value === id
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

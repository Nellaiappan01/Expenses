"use client";

import type { PaymentMethod } from "@/lib/types";

type PaymentMethodToggleProps = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
};

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "Cash", label: "Cash" },
  { id: "GPay", label: "GPay" },
];

export default function PaymentMethodToggle({ value, onChange }: PaymentMethodToggleProps) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Payment
      </p>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-xl py-4 text-base font-semibold transition-all duration-200 active:scale-[0.98] ${
              value === id
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

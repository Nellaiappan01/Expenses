"use client";

import type { PaymentMethod } from "@/lib/types";

type Props = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
};

export default function ExpensePaymentToggle({ value, onChange }: Props) {
  const bankSelected = value === "Bank" || value === "GPay";

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange("Cash")}
        className={`flex items-center justify-center gap-2 rounded-xl border-2 px-2 py-3 text-left transition-all ${
          value === "Cash"
            ? "border-[#0B4A8C] bg-[#EEF5FC]"
            : "border-[#D6E6F5] bg-white hover:border-[#9BBDE0]"
        }`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
            value === "Cash" ? "border-[#0B4A8C]" : "border-[#B8CDE3]"
          }`}
        >
          {value === "Cash" && <span className="h-2 w-2 rounded-full bg-[#0B4A8C]" />}
        </span>
        <svg className="h-4 w-4 text-[#0B4A8C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className="text-sm font-semibold text-[#0B4A8C]">Cash</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("Bank")}
        className={`flex items-center justify-center gap-2 rounded-xl border-2 px-2 py-3 text-left transition-all ${
          bankSelected
            ? "border-[#0B4A8C] bg-[#EEF5FC]"
            : "border-[#D6E6F5] bg-white hover:border-[#9BBDE0]"
        }`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
            bankSelected ? "border-[#0B4A8C]" : "border-[#B8CDE3]"
          }`}
        >
          {bankSelected && <span className="h-2 w-2 rounded-full bg-[#0B4A8C]" />}
        </span>
        <svg className="h-4 w-4 text-[#0B4A8C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span className="text-sm font-semibold text-[#0B4A8C]">Bank A/c</span>
      </button>
    </div>
  );
}

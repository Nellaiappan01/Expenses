"use client";

import Link from "next/link";

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function AdjustIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function SheetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v6h6M8 13h8M8 17h8M8 9h3" />
    </svg>
  );
}

const actions = [
  {
    href: "/wallet",
    label: "Wallet",
    Icon: WalletIcon,
    iconBg: "bg-blue-100 text-blue-600",
    ring: "focus-visible:ring-blue-500/30",
  },
  {
    href: "/adjust",
    label: "Adjust",
    Icon: AdjustIcon,
    iconBg: "bg-amber-100 text-amber-600",
    ring: "focus-visible:ring-amber-500/30",
  },
  {
    href: "/sheet",
    label: "Sheet",
    Icon: SheetIcon,
    iconBg: "bg-[#EEF5FC] text-[#0B4A8C]",
    ring: "focus-visible:ring-[#0B4A8C]/30",
  },
] as const;

export default function LedgerActionButtons() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map(({ href, label, Icon, iconBg, ring }) => (
        <Link
          key={href}
          href={href}
          className={`flex h-full flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-2.5 shadow-sm transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 ${ring}`}
          aria-label={label}
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-xs font-semibold text-zinc-600">{label}</span>
        </Link>
      ))}
    </div>
  );
}

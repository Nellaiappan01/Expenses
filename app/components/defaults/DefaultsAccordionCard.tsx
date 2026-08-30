"use client";

import type { ReactNode } from "react";

export type DefaultsCardIcon =
  | "notes"
  | "category"
  | "people"
  | "approver"
  | "bank"
  | "drive"
  | "brand"
  | "sheet"
  | "script";

function CardIcon({ name }: { name: DefaultsCardIcon }) {
  const cls = "h-5 w-5";
  if (name === "notes") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 12h6m-6 4h6M7 4h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
        />
      </svg>
    );
  }
  if (name === "category") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M7 7h.01M7 3h10a1 1 0 011 1v16l-6-3-6 3V4a1 1 0 011-1z"
        />
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    );
  }
  if (name === "approver") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    );
  }
  if (name === "bank") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M3 10l9-7 9 7M4 10h16v10H4V10zm4 10V14h8v6"
        />
      </svg>
    );
  }
  if (name === "brand") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
        />
      </svg>
    );
  }
  if (name === "sheet") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M3 7a2 2 0 012-2h6l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (name === "script") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 9l-3 3 3 3m8-6l3 3-3 3M13 5l-2 14"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

export function DefaultsAccordionCard({
  title,
  count,
  meta,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  meta?: string;
  icon: DefaultsCardIcon;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#D6E6F5] bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF5FC] text-[#0B4A8C]">
          <CardIcon name={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#0B4A8C]">{title}</span>
          {meta ? <span className="mt-0.5 block truncate text-[11px] font-medium text-[#7A9BB8]">{meta}</span> : null}
        </span>
        {typeof count === "number" ? (
          <span className="rounded-full bg-[#EEF5FC] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0B4A8C]">
            {count}
          </span>
        ) : null}
        <svg
          className={`h-5 w-5 shrink-0 text-[#7A9BB8] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? <div className="border-t border-[#D6E6F5] px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

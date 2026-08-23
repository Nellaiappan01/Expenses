"use client";

import Link from "next/link";
import { useUser } from "@/app/context/UserContext";

type AdminTab = "settings" | "payments";

export default function AdminShell({
  active,
  title,
  subtitle,
  children,
}: {
  active: AdminTab;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { isAdmin } = useUser();

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F8FC] px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#0B4A8C]">Access Denied</h1>
          <p className="mt-2 text-sm text-[#5A7FA5]">Admin access required.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#0B4A8C]">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; href: string; label: string }[] = [
    { id: "settings", href: "/admin", label: "Settings" },
    { id: "payments", href: "/admin/payments", label: "Payments" },
  ];

  return (
    <div className="min-h-screen bg-[#F4F8FC]">
      <div className="mx-auto max-w-lg px-3 py-4 pb-24 sm:px-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D6E6F5] bg-white text-[#0B4A8C] shadow-sm hover:bg-[#F8FBFE]"
            aria-label="Back to home"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-[#0B4A8C]">{title}</h1>
            <p className="text-sm text-[#5A7FA5]">{subtitle}</p>
          </div>
        </header>

        <nav
          className="mb-4 flex gap-2 rounded-2xl border border-[#D6E6F5] bg-white p-1.5 shadow-sm"
          aria-label="Admin sections"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
                active === tab.id
                  ? "bg-[#0B4A8C] text-white shadow-sm"
                  : "text-[#5A7FA5] hover:bg-[#F4F8FC]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}

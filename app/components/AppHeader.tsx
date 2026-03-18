"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConfig } from "../context/ConfigContext";
import { useUser } from "../context/UserContext";
import { apiFetch } from "@/lib/api";

const baseNavItems = [
  { href: "/report", label: "Report", icon: ReportIcon },
  { href: "/worker-history", label: "Worker details", icon: WorkerDetailsIcon, feature: "workers" as const },
  { href: "/stock", label: "Stock", icon: StockIcon, feature: "stock" as const },
  { href: "/defaults", label: "Defaults", icon: SettingsIcon },
];
const adminNavItem = { href: "/admin", label: "Admin", icon: SettingsIcon };

function ReportIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function WorkerDetailsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function StockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { config } = useConfig() ?? {};
  const { userName, isAdmin, clearUser } = useUser();

  async function handleLogout() {
    setMenuOpen(false);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearUser();
    router.push("/select-user");
    router.refresh();
  }

  if (pathname === "/select-user") return null;

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex min-h-16 items-center justify-between gap-2 border-b border-zinc-200/80 bg-white/95 px-4 py-2 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/95 pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
          <h1 className="truncate text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
            Cash Flow Ledger
          </h1>
          <Link
            href="/select-user"
            className="truncate text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {userName || "Switch User"}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="More menu"
          >
            <HamburgerIcon />
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm nav-sheet-backdrop transition-opacity"
            aria-label="Close menu"
          />
          <div className="nav-sheet fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border-t border-zinc-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-md px-4 pt-3 pb-6">
              <div className="mb-2 flex justify-center">
                <div className="h-1 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden />
              </div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  More
                </p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg p-2 -m-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-1">
                {(isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems)
                  .filter((item) => {
                    if (!("feature" in item)) return true;
                    const f = item.feature as keyof NonNullable<typeof config>["features"];
                    return !!config?.features?.[f];
                  })
                  .map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-4 rounded-xl px-4 py-3.5 min-h-[48px] transition-colors active:scale-[0.98] ${
                        active
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "text-zinc-700 active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800"
                      }`}
                    >
                      <Icon />
                      <span className="font-medium">{label}</span>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 min-h-[48px] text-left text-zinc-700 transition-colors active:scale-[0.98] active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800"
                >
                  <LogoutIcon />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConfig } from "@/app/context/ConfigContext";

/** Bottom bar on godown / stock in / out / dashboard — Claim is in header menu only. */
const stockNavItems = [
  { href: "/stock", label: "Godown", icon: StockIcon },
  { href: "/stock/in", label: "In", icon: StockInIcon },
  { href: "/stock/out", label: "Out", icon: StockOutIcon },
  { href: "/stock/dashboard", label: "Report", icon: DashboardIcon },
];

const ledgerNavItems = [
  { href: "/", label: "Home", icon: HomeIcon, ledger: true },
  { href: "/totals", label: "Totals", icon: TotalsIcon, ledger: true },
  { href: "/track", label: "Track", icon: TrackIcon, ledger: true },
  { href: "/report", label: "Report", icon: ReportIcon, ledger: true },
];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ReportIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function TotalsIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function TrackIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function StockIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function StockInIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M4 12h16m0 0l-4-4m4 4l-4 4" />
    </svg>
  );
}

function StockOutIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M20 12H4m0 0l4-4m-4 4l4 4" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function stockPathActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/stock") return pathname === "/stock" || pathname === "/stock/";
  if (href === "/stock/in") return pathname.startsWith("/stock/in");
  if (href === "/stock/out") return pathname.startsWith("/stock/out");
  if (href === "/stock/dashboard") return pathname.startsWith("/stock/dashboard");
  return false;
}

export default function Navbar() {
  const pathname = usePathname();
  const { config } = useConfig() ?? {};

  if (pathname === "/select-user") return null;

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  const hasStock = !!features.stock;
  const onStockArea = pathname.startsWith("/stock");

  const useStockBar = hasStock && onStockArea;

  const navItems = useStockBar
    ? stockNavItems
    : ledgerNavItems.filter((item) => {
        const hasLedger = features.expenses || features.workers;
        if ("ledger" in item && item.ledger) return hasLedger;
        return true;
      });

  const isActive = (href: string) =>
    useStockBar ? stockPathActive(pathname, href) : pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2.5 min-h-[60px] transition-colors touch-manipulation select-none ${
                active ? "text-emerald-600" : "text-zinc-500 active:text-zinc-700"
              }`}
            >
              <Icon active={active} />
              <span className="text-[10px] font-semibold leading-tight truncate max-w-full">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

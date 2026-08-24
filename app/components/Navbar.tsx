"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useConfig } from "@/app/context/ConfigContext";
import { useUser } from "@/app/context/UserContext";
import { isPublicRoute } from "@/lib/publicRoutes";
import { publicStockViewPath, publicViewSlug } from "@/lib/publicStockPaths";

/** Bottom bar on godown / stock in / out / dashboard / public view */
const stockNavItems = [
  { href: "/stock", label: "Godown", icon: StockIcon },
  { href: "/stock/in", label: "In", icon: StockInIcon },
  { href: "/stock/out", label: "Out", icon: StockOutIcon },
  { href: "/stock/dashboard", label: "Report", icon: DashboardIcon },
];

function PayIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 2.5 : 2}
        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

const ledgerNavItems = [
  { href: "/", label: "Home", icon: HomeIcon, ledger: true },
  { href: "/totals", label: "Totals", icon: TotalsIcon, ledger: true },
  { href: "/track", label: "Track", icon: TrackIcon, ledger: true },
  { href: "/report", label: "Report", icon: ReportIcon, ledger: true },
];

const adminLedgerNavItems = [
  { href: "/", label: "Home", icon: HomeIcon, ledger: true },
  { href: "/admin/payments", label: "Pay", icon: PayIcon },
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

function ViewIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function stockPathActive(pathname: string, href: string, viewPath?: string | null): boolean {
  if (pathname === href) return true;
  if (href === "/stock") return pathname === "/stock" || pathname === "/stock/";
  if (href === "/stock/in") return pathname.startsWith("/stock/in");
  if (href === "/stock/out") return pathname.startsWith("/stock/out");
  if (href === "/stock/dashboard") return pathname.startsWith("/stock/dashboard");
  if (viewPath && href === viewPath) return pathname === viewPath || pathname === `${viewPath}/`;
  return false;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const { userId, username, isAdmin } = useUser();

  if (pathname === "/select-user") return null;

  if (isPublicRoute(pathname)) return null;

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  const hasStock = !!features.stock;
  const onStockArea = pathname.startsWith("/stock");
  const viewSlug = publicViewSlug(username, userId);
  const viewPath = viewSlug ? publicStockViewPath(viewSlug) : null;
  const onPublicView = viewPath ? pathname === viewPath || pathname === `${viewPath}/` : false;

  const useStockBar = hasStock && (onStockArea || onPublicView);

  const navItems = useMemo(
    () =>
      useStockBar
        ? [
            ...stockNavItems.slice(0, 3),
            ...(viewPath ? [{ href: viewPath, label: "View", icon: ViewIcon }] : []),
            stockNavItems[3],
          ]
        : (isAdmin ? adminLedgerNavItems : ledgerNavItems).filter((item) => {
            const hasLedger = features.expenses || features.workers;
            if ("ledger" in item && item.ledger) return hasLedger;
            return true;
          }),
    [useStockBar, viewPath, features.expenses, features.workers, isAdmin]
  );

  useEffect(() => {
    for (const { href } of navItems) {
      router.prefetch(href);
    }
  }, [router, navItems]);

  const isActive = (href: string) =>
    useStockBar
      ? stockPathActive(pathname, href, viewPath)
      : href === "/admin/payments"
        ? pathname.startsWith("/admin/payments")
        : pathname === href || (href !== "/" && pathname.startsWith(href));

  const activeColor = useStockBar ? "#059669" : "#0B4A8C";
  const activeBg = useStockBar ? "#ECFDF5" : "#EEF5FC";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none"
      aria-label="Main navigation"
    >
      <div className="ui-nav-dock pointer-events-auto mx-auto max-w-md">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
            <Link
              key={href}
              href={href}
              prefetch
                aria-current={active ? "page" : undefined}
                className="relative flex min-h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 touch-manipulation select-none"
              >
                {active ? (
                  <span
                    className="absolute top-1.5 h-1 w-8 rounded-full"
                    style={{ backgroundColor: activeColor }}
                    aria-hidden
                  />
                ) : null}

                <span
                  className={`mt-1 flex h-8 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                    active ? "scale-105" : ""
                  }`}
                  style={{
                    backgroundColor: active ? activeBg : "transparent",
                    color: active ? activeColor : "#94A3B8",
                  }}
                >
                  <Icon active={active} />
                </span>

                <span
                  className="max-w-full truncate text-[10px] leading-tight transition-colors duration-200"
                  style={{
                    color: active ? activeColor : "#94A3B8",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

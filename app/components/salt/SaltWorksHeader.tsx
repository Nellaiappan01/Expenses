"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  APP_NAME,
  SALT_BANNER_HEIGHT,
  SALT_HEADER_BANNER_URL,
  headerBannerForViewport,
  headerBannerUrl,
} from "@/lib/brandAssets";
import { useConfig } from "@/app/context/ConfigContext";
import { useUser } from "@/app/context/UserContext";

function BackIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

const FEATURES = [
  {
    label: "CONTRACT BASED PRODUCTION",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 11l5-5 5 5M12 6v12" />
      </svg>
    ),
  },
  {
    label: "QUALITY ASSURED",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: "TRUST & TRANSPARENCY",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function SaltWorksHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { userName, clearUser, isAdmin } = useUser();
  const { config } = useConfig() ?? {};
  const [menuOpen, setMenuOpen] = useState(false);

  const bannerBaseUrl = config?.branding?.bannerUrl || SALT_HEADER_BANNER_URL;
  const appName = config?.branding?.appName || APP_NAME;
  const fallbackSrc = headerBannerUrl(bannerBaseUrl, 896, SALT_BANNER_HEIGHT.mobile * 2);
  const [bannerSrc, setBannerSrc] = useState(fallbackSrc);

  useEffect(() => {
    function updateBanner() {
      const { src } = headerBannerForViewport(bannerBaseUrl, window.innerWidth);
      setBannerSrc(src);
    }

    updateBanner();
    window.addEventListener("resize", updateBanner);
    return () => window.removeEventListener("resize", updateBanner);
  }, [bannerBaseUrl]);

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

  return (
    <header className="salt-header relative overflow-hidden bg-[#F4F8FC]">
      <div className="relative mx-auto w-full max-w-md">
        <div className="relative h-36 w-full sm:h-40 lg:h-44">
          <Image
            src={bannerSrc}
            alt={`${appName} — header banner`}
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 448px) 100vw, 448px"
            unoptimized
          />
        </div>

        <div className={`absolute inset-x-0 top-0 flex items-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] ${isHome ? "justify-end" : "justify-between"}`}>
          {!isHome && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#0B4A8C] shadow-sm backdrop-blur-sm"
              aria-label="Go back"
            >
              <BackIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#0B4A8C] shadow-sm backdrop-blur-sm"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md border-t border-[#D6E6F5] bg-white px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1 px-1">
              <span className="text-[#0B4A8C]">{f.icon}</span>
              <span className="text-center text-[8px] font-bold leading-tight text-[#5A7FA5] sm:text-[9px]">
                {f.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            aria-label="Close menu"
          />
          <div className="nav-sheet fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-md px-4 pt-3 pb-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Menu</p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mb-3 text-sm text-zinc-600">{userName || "User"}</p>
              <div className="space-y-1">
                <Link
                  href="/defaults"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center rounded-xl px-4 py-3 text-zinc-700 hover:bg-zinc-50"
                >
                  Defaults
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center rounded-xl px-4 py-3 text-zinc-700 hover:bg-zinc-50"
                >
                  Account &amp; Sheet
                </Link>
                <Link
                  href="/report"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center rounded-xl px-4 py-3 text-zinc-700 hover:bg-zinc-50"
                >
                  Report
                </Link>
                {config?.features?.profitability && (
                  <Link
                    href="/profitability"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center rounded-xl px-4 py-3 font-medium text-[#0B4A8C] hover:bg-[#EEF5FC]"
                  >
                    Profitability
                  </Link>
                )}
                {isAdmin && (
                  <>
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center rounded-xl px-4 py-3 font-medium text-[#0B4A8C] hover:bg-[#EEF5FC]"
                    >
                      Admin Settings
                    </Link>
                    <Link
                      href="/admin/payments"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center rounded-xl px-4 py-3 font-medium text-[#0B4A8C] hover:bg-[#EEF5FC]"
                    >
                      Payment Management
                    </Link>
                  </>
                )}
                <Link
                  href="/select-user"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center rounded-xl px-4 py-3 text-zinc-700 hover:bg-zinc-50"
                >
                  Switch user
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center rounded-xl px-4 py-3 text-left text-zinc-700 hover:bg-zinc-50"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

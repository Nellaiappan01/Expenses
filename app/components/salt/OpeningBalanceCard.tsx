"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { readBalanceCache, writeBalanceCache } from "@/lib/balanceClient";
import { formatDateDisplay } from "@/lib/dateFormat";
import { useUser } from "@/app/context/UserContext";
import LedgerActionButtons from "../LedgerActionButtons";

const LONG_PRESS_MS = 500;

type BalanceSummary = {
  net: number;
  pendingApproval: number;
  paymentPending: number;
  totalUnpaid: number;
};

function formatAmount(amount: number) {
  return `₹ ${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatLastUpdated() {
  return new Date().toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function OpeningBalanceCard({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const { userId } = useUser();
  const [summary, setSummary] = useState<BalanceSummary | null>(() => {
    if (!userId) return null;
    const cached = readBalanceCache(userId);
    return cached !== null
      ? { net: cached, pendingApproval: 0, paymentPending: 0, totalUnpaid: 0 }
      : null;
  });
  const [updatedAt, setUpdatedAt] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const suppressClick = useRef(false);
  const cardLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardLongPressTriggered = useRef(false);

  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch("/api/balance");
      if (res.ok) {
        const data = await res.json();
        const next: BalanceSummary = {
          net: data.net ?? 0,
          pendingApproval: data.pendingApproval ?? 0,
          paymentPending: data.paymentPending ?? 0,
          totalUnpaid: data.totalUnpaid ?? 0,
        };
        setSummary(next);
        writeBalanceCache(userId, next.net);
        setUpdatedAt(formatLastUpdated());
      }
    } catch {
      setSummary((prev) =>
        prev ?? { net: 0, pendingApproval: 0, paymentPending: 0, totalUnpaid: 0 }
      );
      setUpdatedAt(formatLastUpdated());
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const cached = readBalanceCache(userId);
    if (cached !== null) {
      setSummary((prev) => ({
        net: cached,
        pendingApproval: prev?.pendingApproval ?? 0,
        paymentPending: prev?.paymentPending ?? 0,
        totalUnpaid: prev?.totalUnpaid ?? 0,
      }));
      setUpdatedAt(formatLastUpdated());
    }
    fetchBalance();
  }, [userId, fetchBalance, refreshTrigger]);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (cardLongPressTimer.current) clearTimeout(cardLongPressTimer.current);
    };
  }, []);

  const clearLongPress = (timer: typeof longPressTimer) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const toggleActions = () => setShowActions((v) => !v);
  const toggleBreakdown = () => setShowBreakdown((v) => !v);

  const handleWalletPress = () => {
    if (suppressClick.current) return;
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    toggleActions();
  };

  const handleWalletTouchStart = () => {
    longPressTriggered.current = false;
    clearLongPress(longPressTimer);
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      toggleActions();
    }, LONG_PRESS_MS);
  };

  const handleWalletTouchEnd = () => {
    const wasLongPress = longPressTriggered.current;
    clearLongPress(longPressTimer);
    if (!wasLongPress) {
      suppressClick.current = true;
      toggleActions();
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 400);
    }
  };

  const handleCardTouchStart = () => {
    cardLongPressTriggered.current = false;
    clearLongPress(cardLongPressTimer);
    cardLongPressTimer.current = setTimeout(() => {
      cardLongPressTriggered.current = true;
      toggleBreakdown();
    }, LONG_PRESS_MS);
  };

  const handleCardTouchEnd = () => {
    clearLongPress(cardLongPressTimer);
  };

  if (summary === null) {
    return <div className="h-24 animate-pulse rounded-2xl bg-[#0B4A8C]/20" aria-hidden />;
  }

  const hasUnpaid = summary.totalUnpaid > 0;
  const surplusAfterUnpaid = summary.net - summary.totalUnpaid;
  const balanceEnough = surplusAfterUnpaid >= 0;

  return (
    <div className="space-y-2">
      <div
        className={`salt-balance-card relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-[#0B4A8C] to-[#062f5c] px-3.5 py-3 text-white shadow-[0_12px_40px_rgba(11,74,140,0.35)] transition-all duration-300 ${
          showBreakdown ? "ring-2 ring-white/40" : showActions ? "ring-2 ring-white/50 ring-offset-2 ring-offset-[#F4F8FC]" : ""
        }`}
        onTouchStart={isTouch ? handleCardTouchStart : undefined}
        onTouchEnd={isTouch ? handleCardTouchEnd : undefined}
        onTouchCancel={isTouch ? handleCardTouchEnd : undefined}
        onContextMenu={(e) => {
          e.preventDefault();
          toggleBreakdown();
        }}
      >
        <div className="absolute -right-4 bottom-0 opacity-10">
          <svg width="140" height="80" viewBox="0 0 140 80" fill="none" aria-hidden>
            <path d="M10 60c20-15 40-20 60-15s35 20 50 10" stroke="white" strokeWidth="8" strokeLinecap="round" />
            <path d="M0 70c25-10 50-12 75-5s40 15 65 0" stroke="white" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="relative flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={toggleBreakdown}
            className="min-w-0 flex-1 text-left touch-manipulation"
            aria-expanded={showBreakdown}
            aria-label="Opening balance details"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">
              Opening Balance
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums tracking-tight">
              {formatAmount(summary.net)}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-white/75">
              Current Available Balance
              {hasUnpaid && !showBreakdown ? (
                <span className="text-white/45"> · {isTouch ? "hold" : "tap"} for details</span>
              ) : null}
            </p>
          </button>
          <button
            type="button"
            onClick={handleWalletPress}
            onTouchStart={isTouch ? handleWalletTouchStart : undefined}
            onTouchEnd={isTouch ? handleWalletTouchEnd : undefined}
            onTouchCancel={isTouch ? handleWalletTouchEnd : undefined}
            aria-pressed={showActions}
            aria-label={showActions ? "Hide wallet and adjust" : "Show wallet and adjust"}
            className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0B4A8C] shadow-md transition-transform active:scale-95 touch-manipulation"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </button>
        </div>

        {showBreakdown && (
          <div className="relative mt-3 border-t border-white/15 pt-3">
            <div className="overflow-hidden rounded-xl border border-white/12 bg-black/15">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-white/45" aria-hidden />
                  <span className="truncate text-[11px] font-medium tracking-wide text-white/65">
                    Pending approval
                  </span>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-white/90">
                  {formatAmount(summary.pendingApproval)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[#C9B07A]" aria-hidden />
                  <span className="truncate text-[11px] font-medium tracking-wide text-white/65">
                    Awaiting payment
                  </span>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-white/90">
                  {formatAmount(summary.paymentPending)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-white/[0.04] px-3 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                  Total unpaid
                </span>
                <span className="text-sm font-bold tabular-nums text-white">
                  {formatAmount(summary.totalUnpaid)}
                </span>
              </div>
            </div>

            {hasUnpaid && (
              <div
                className={`mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                  balanceEnough
                    ? "border-[#6FA892]/35 bg-[#1A4D3E]/25"
                    : "border-[#B87A6E]/40 bg-[#4A2824]/30"
                }`}
              >
                <span className="text-[11px] font-semibold tracking-wide text-white/85">
                  {balanceEnough ? "Balance sufficient" : "Shortfall"}
                </span>
                <span
                  className={`text-xs font-bold tabular-nums ${
                    balanceEnough ? "text-[#9FD4BC]" : "text-[#E8B4AC]"
                  }`}
                >
                  {balanceEnough
                    ? `Excess ${formatAmount(surplusAfterUnpaid)}`
                    : `Short ${formatAmount(Math.abs(surplusAfterUnpaid))}`}
                </span>
              </div>
            )}

            <p className="mt-2 text-right text-[9px] tracking-wide text-white/45">
              Updated {formatDateDisplay(new Date())}
              {updatedAt ? ` · ${updatedAt}` : ""}
            </p>
          </div>
        )}
      </div>

      {showActions ? <LedgerActionButtons /> : null}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { readBalanceCache, writeBalanceCache } from "@/lib/balanceClient";
import { formatDateDisplay } from "@/lib/dateFormat";
import { useUser } from "@/app/context/UserContext";
import LedgerActionButtons from "../LedgerActionButtons";

const LONG_PRESS_MS = 500;

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
  const [balance, setBalance] = useState<number | null>(() =>
    userId ? readBalanceCache(userId) : null
  );
  const [updatedAt, setUpdatedAt] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const suppressClick = useRef(false);

  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch("/api/balance");
      if (res.ok) {
        const data = await res.json();
        const net = data.net ?? 0;
        setBalance(net);
        writeBalanceCache(userId, net);
        setUpdatedAt(formatLastUpdated());
      }
    } catch {
      setBalance((prev) => (prev === null ? 0 : prev));
      setUpdatedAt(formatLastUpdated());
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const cached = readBalanceCache(userId);
    if (cached !== null) {
      setBalance(cached);
      setUpdatedAt(formatLastUpdated());
    }
    fetchBalance();
  }, [userId, fetchBalance, refreshTrigger]);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleActions = () => setShowActions((v) => !v);

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
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      toggleActions();
    }, LONG_PRESS_MS);
  };

  const handleWalletTouchEnd = () => {
    const wasLongPress = longPressTriggered.current;
    clearLongPress();
    if (!wasLongPress) {
      suppressClick.current = true;
      toggleActions();
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 400);
    }
  };

  if (balance === null) {
    return <div className="h-28 animate-pulse rounded-2xl bg-[#0B4A8C]/20" aria-hidden />;
  }

  return (
    <div className="space-y-2">
      <div
        className={`salt-balance-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B4A8C] to-[#083A6E] px-4 py-4 text-white shadow-lg transition-shadow ${
          showActions ? "ring-2 ring-white/50 ring-offset-2 ring-offset-[#F4F8FC]" : ""
        }`}
      >
        <div className="absolute -right-4 bottom-0 opacity-10">
          <svg width="140" height="80" viewBox="0 0 140 80" fill="none" aria-hidden>
            <path d="M10 60c20-15 40-20 60-15s35 20 50 10" stroke="white" strokeWidth="8" strokeLinecap="round" />
            <path d="M0 70c25-10 50-12 75-5s40 15 65 0" stroke="white" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">
              Opening Balance
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
              {formatAmount(balance)}
            </p>
            <p className="mt-1 text-xs text-white/80">Current Available Balance</p>
          </div>
          <button
            type="button"
            onClick={handleWalletPress}
            onTouchStart={isTouch ? handleWalletTouchStart : undefined}
            onTouchEnd={isTouch ? handleWalletTouchEnd : undefined}
            onTouchCancel={isTouch ? handleWalletTouchEnd : undefined}
            aria-pressed={showActions}
            aria-label={
              showActions ? "Hide wallet and adjust" : "Show wallet and adjust"
            }
            className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#0B4A8C] shadow-md transition-transform active:scale-95 touch-manipulation"
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
        <p className="relative mt-3 text-right text-[10px] text-white/65">
          Last updated: {formatDateDisplay(new Date())}
          {updatedAt ? `, ${updatedAt}` : ""}
        </p>
      </div>

      {showActions ? <LedgerActionButtons /> : null}
    </div>
  );
}

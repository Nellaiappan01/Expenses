"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";

const LONG_PRESS_MS = 500;

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "" : "-";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function NetAmountCard({
  refreshTrigger = 0,
  showActions = false,
  onToggleActions,
}: {
  refreshTrigger?: number;
  showActions?: boolean;
  onToggleActions?: () => void;
}) {
  const [net, setNet] = useState<number | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiFetch("/api/dashboard/summary");
      if (res.ok) {
        const data = await res.json();
        setNet(data.net ?? 0);
      }
    } catch {
      setNet(0);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshTrigger]);

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

  const handleClick = () => {
    if (isTouch) return;
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onToggleActions?.();
  };

  const handleTouchStart = () => {
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onToggleActions?.();
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = () => {
    clearLongPress();
  };

  if (net === null) {
    return (
      <div className="h-16 animate-pulse rounded-xl bg-white/60" aria-hidden />
    );
  }

  const positive = net >= 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchStart={isTouch ? handleTouchStart : undefined}
      onTouchEnd={isTouch ? handleTouchEnd : undefined}
      onTouchCancel={isTouch ? handleTouchEnd : undefined}
      aria-pressed={showActions}
      aria-label={
        showActions
          ? "Hide wallet and adjust"
          : isTouch
            ? "Long press to show wallet and adjust"
            : "Click to show wallet and adjust"
      }
      className={`net-card-enter flex w-full items-baseline justify-between rounded-xl px-4 py-2.5 text-left transition-transform active:scale-[0.98] ${
        positive ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      } ${showActions ? "ring-2 ring-white/40 ring-offset-2 ring-offset-zinc-100" : ""}`}
    >
      <span className="text-xs font-semibold uppercase tracking-widest opacity-80">
        Net
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-tight">
        {formatAmount(net)}
      </span>
    </button>
  );
}

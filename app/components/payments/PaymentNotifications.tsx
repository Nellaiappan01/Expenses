"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const DISMISS_KEY = "ledger_payment_notifications_dismissed";

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...new Set(ids)]));
}

export default function PaymentNotifications({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [messages, setMessages] = useState<{ entryId: string; message: string }[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());
  const loadSeq = useRef(0);

  useEffect(() => {
    dismissedRef.current = new Set(readDismissed());
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const res = await apiFetch("/api/payment-notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (seq !== loadSeq.current) return;

      const dismissed = new Set([...dismissedRef.current, ...readDismissed()]);
      dismissedRef.current = dismissed;
      const list = (data.notifications ?? []).filter(
        (n: { entryId?: string }) => n.entryId && !dismissed.has(n.entryId)
      );
      const seen = new Set<string>();
      const deduped = list.filter((n: { entryId: string; message: string }) => {
        if (seen.has(n.entryId)) return false;
        seen.add(n.entryId);
        return true;
      });
      setMessages(deduped);
    } catch {
      if (seq === loadSeq.current) setMessages([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  function dismiss(entryId: string) {
    dismissedRef.current.add(entryId);
    try {
      writeDismissed([...readDismissed(), entryId]);
    } catch {
      /* ignore */
    }
    setMessages((prev) => prev.filter((m) => m.entryId !== entryId));
    void apiFetch("/api/payment-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
  }

  if (messages.length === 0) return null;

  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div
          key={m.entryId}
          className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900"
          role="status"
        >
          <span className="mt-0.5 shrink-0">🟢</span>
          <p className="flex-1 font-medium">{m.message}</p>
          <button
            type="button"
            onClick={() => dismiss(m.entryId)}
            className="shrink-0 text-xs font-semibold text-green-700 underline"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const DISMISS_KEY = "ledger_payment_notifications_dismissed";

export default function PaymentNotifications({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [messages, setMessages] = useState<{ entryId: string; message: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/payment-notifications");
      if (!res.ok) return;
      const data = await res.json();
      let dismissed: string[] = [];
      try {
        dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
      } catch {
        dismissed = [];
      }
      const list = (data.notifications ?? []).filter(
        (n: { entryId: string }) => !dismissed.includes(n.entryId)
      );
      setMessages(list);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  function dismiss(entryId: string) {
    try {
      const dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]") as string[];
      if (!dismissed.includes(entryId)) {
        dismissed.push(entryId);
        localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed));
      }
    } catch {
      /* ignore */
    }
    setMessages((prev) => prev.filter((m) => m.entryId !== entryId));
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

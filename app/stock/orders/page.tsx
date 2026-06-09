"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "@/app/context/ConfigContext";
import { useUser } from "@/app/context/UserContext";
import type { StockRequest } from "@/lib/stockRequestTypes";
import { isValidMobile, sanitizeMobileInput } from "@/lib/phone";
import { matchesStockSearch } from "@/lib/stockSearch";
import type { StockFlowItem } from "../components/StockMovementFlow";
import { OrderClaimFlow } from "../components/OrderClaimFlow";

export default function StockOrdersPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const { userName } = useUser();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [items, setItems] = useState<StockFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addStockId, setAddStockId] = useState("");
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  useEffect(() => {
    if (config && !config.features?.stock) {
      router.replace("/");
    }
  }, [config, router]);

  const fetchRequests = useCallback(async () => {
    const res = await apiFetch("/api/stock/requests?status=all");
    if (res.ok) setRequests(await res.json());
  }, []);

  const fetchItems = useCallback(async () => {
    const res = await apiFetch("/api/stock");
    if (res.ok) setItems(await res.json());
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRequests(), fetchItems()]);
    } finally {
      setLoading(false);
    }
  }, [fetchRequests, fetchItems]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleApprove(id: string, resolutionNote?: string) {
    setError("");
    const res = await apiFetch(`/api/stock/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", resolutionNote }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchRequests();
      return true;
    }
    setError(data.error || "Approve failed");
    return false;
  }

  async function handleReject(id: string, resolutionNote?: string) {
    setError("");
    const res = await apiFetch(`/api/stock/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", resolutionNote }),
    });
    if (res.ok) {
      await fetchRequests();
      return true;
    }
    const data = await res.json();
    setError(data.error || "Reject failed");
    return false;
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addStockId || !addName.trim() || !isValidMobile(addPhone)) return;
    setAddSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/stock/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: addStockId,
          qty: 1,
          customerName: addName.trim(),
          customerPhone: addPhone.trim(),
          note: addNote.trim() || undefined,
        }),
      });
      if (res.ok) {
        setAddOpen(false);
        setAddName("");
        setAddPhone("");
        setAddNote("");
        setAddSearch("");
        setAddStockId("");
        await fetchRequests();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } finally {
      setAddSaving(false);
    }
  }

  const filteredItems = items.filter((it) => {
    const q = addSearch.trim();
    if (!q) return true;
    return matchesStockSearch(it, q);
  });

  if (!config) return null;

  return (
    <>
      <OrderClaimFlow
        requests={requests}
        loading={loading}
        shopName={userName ?? undefined}
        error={error}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={fetchRequests}
        onAddRequest={() => setAddOpen(true)}
      />

      {addOpen && (
        <>
          <button
            type="button"
            onClick={() => setAddOpen(false)}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            aria-label="Close"
          />
          <div className="nav-sheet fixed inset-x-0 bottom-0 z-[81] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[env(safe-area-inset-bottom)]">
            <h3 className="mb-1 text-lg font-bold text-zinc-900">New claim</h3>
            <p className="mb-4 text-xs text-zinc-500">Customer name &amp; mobile.</p>
            <form onSubmit={submitAdd} className="space-y-3">
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Customer name *"
                required
                className="w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200"
              />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(sanitizeMobileInput(e.target.value))}
                placeholder="10-digit mobile *"
                required
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                className="w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-sm tabular-nums ring-1 ring-zinc-200"
              />
              {addPhone.length > 0 && addPhone.length < 10 && (
                <p className="text-xs text-amber-700">Enter 10 digits ({addPhone.length}/10)</p>
              )}
              <input
                type="search"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search product…"
                className="w-full rounded-xl bg-indigo-50 px-3 py-2.5 text-sm ring-1 ring-indigo-100"
              />
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-1">
                {filteredItems.slice(0, 20).map((it) => (
                  <button
                    key={it._id}
                    type="button"
                    onClick={() => setAddStockId(it._id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                      addStockId === it._id ? "bg-indigo-100 font-semibold text-indigo-900" : ""
                    }`}
                  >
                    <span className="truncate">{it.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{it.count} pcs</span>
                  </button>
                ))}
              </div>
              <textarea
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="Damage / return reason (optional)"
                rows={2}
                className="w-full resize-none rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200"
              />
              <button
                type="submit"
                disabled={
                  addSaving ||
                  !addStockId ||
                  !addName.trim() ||
                  !isValidMobile(addPhone)
                }
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 font-bold text-white disabled:opacity-50"
              >
                {addSaving ? "Saving…" : "Save claim"}
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { uploadStockPhoto } from "@/lib/uploadStockPhoto";
import { toLocalDateString } from "@/lib/dateFormat";
import { useConfig } from "@/app/context/ConfigContext";
import { useUser } from "@/app/context/UserContext";
import {
  StockMovementFlow,
  type StockFlowItem,
  type MovementRecord,
} from "../components/StockMovementFlow";

export default function StockOutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config } = useConfig() ?? {};
  const { userName } = useUser();
  const [items, setItems] = useState<StockFlowItem[]>([]);
  const [records, setRecords] = useState<MovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCount, setEditCount] = useState(1);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState(() => toLocalDateString());
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (config && !config.features?.stock) {
      router.replace("/");
    }
  }, [config, router]);

  const fetchItems = useCallback(async () => {
    const res = await apiFetch("/api/stock");
    if (res.ok) setItems(await res.json());
  }, []);

  const fetchRecords = useCallback(async () => {
    const res = await apiFetch("/api/stock/out?limit=50");
    if (res.ok) setRecords(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([fetchItems(), fetchRecords()]).finally(() => setLoading(false));
  }, [fetchItems, fetchRecords]);

  async function handleAddProduct(payload: {
    name: string;
    count: number;
    valuePerUnit: number;
    photoDataUrl?: string | null;
  }): Promise<StockFlowItem | null> {
    setError("");
    const res = await apiFetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        count: payload.count,
        valuePerUnit: payload.valuePerUnit,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      let item = data as StockFlowItem;
      if (payload.photoDataUrl) {
        const uploaded = await uploadStockPhoto(item._id, payload.photoDataUrl);
        if (uploaded) {
          item = {
            ...item,
            hasPhoto: true,
            photoUrl: uploaded.photoUrl,
            photoThumbUrl: uploaded.photoThumbUrl,
          };
        }
      }
      await fetchItems();
      return item;
    }
    setError(data.error || "Failed to add product");
    return null;
  }

  async function handleSave(params: {
    stockId: string;
    count: number;
    note?: string;
    date: string;
  }): Promise<boolean> {
    setError("");
    try {
      const res = await apiFetch("/api/stock/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: params.stockId,
          count: params.count,
          note: params.note,
          date: params.date || toLocalDateString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const removed = params.count;
        const newCount =
          typeof data.newStockCount === "number"
            ? data.newStockCount
            : undefined;
        setItems((prev) =>
          prev.map((i) =>
            i._id === params.stockId
              ? { ...i, count: newCount ?? Math.max(0, i.count - removed) }
              : i
          )
        );
        setRecords((prev) =>
          [
            {
              _id: data._id,
              stockId: data.stockId,
              name: data.name,
              count: data.count,
              note: data.note,
              date: data.date,
              createdAt: data.createdAt,
            },
            ...prev,
          ].slice(0, 30)
        );
        return true;
      }
      setError(data.error || "Failed to save");
      return false;
    } catch {
      setError("Failed to save");
      return false;
    }
  }

  function openEdit(rec: MovementRecord) {
    setEditingId(rec._id);
    setEditCount(rec.count);
    setEditNote(rec.note || "");
    setEditDate(rec.date || toLocalDateString());
  }

  function closeEdit() {
    setEditingId(null);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/stock/out/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: editCount,
          note: editNote.trim() || undefined,
          date: editDate,
        }),
      });
      if (res.ok) {
        closeEdit();
        await Promise.all([fetchRecords(), fetchItems()]);
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this stock out record? Count will be restored.")) return;
    try {
      const res = await apiFetch(`/api/stock/out/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (editingId === id) closeEdit();
        await Promise.all([fetchRecords(), fetchItems()]);
      }
    } catch {
      // ignore
    }
  }

  if (!config) return null;

  return (
    <>
      <StockMovementFlow
        mode="out"
        items={items}
        records={records}
        loading={loading}
        initialStockId={searchParams.get("stockId")}
        error={error}
        onSave={handleSave}
        onAddProduct={handleAddProduct}
        onRecordEdit={openEdit}
        onRecordDelete={handleDelete}
        otherHref="/stock/in"
        otherLabel="Stock In →"
        shopName={userName ?? undefined}
      />

      {editingId && (
        <>
          <button
            type="button"
            onClick={closeEdit}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            aria-label="Close"
          />
          <div className="nav-sheet fixed inset-x-0 bottom-0 z-[81] rounded-t-3xl bg-white p-4 pb-[env(safe-area-inset-bottom)]">
            <h3 className="mb-4 text-lg font-bold text-zinc-900">Edit stock out</h3>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setEditCount((c) => Math.max(1, c - 1))}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-2xl font-bold"
                >
                  −
                </button>
                <span className="text-4xl font-bold tabular-nums">{editCount}</span>
                <button
                  type="button"
                  onClick={() => setEditCount((c) => c + 1)}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-2xl font-bold text-white"
                >
                  +
                </button>
              </div>
              <label className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={editDate}
                  max={toLocalDateString()}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-800"
                />
              </label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Note"
                className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 rounded-2xl bg-zinc-100 py-3 font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 rounded-2xl bg-red-600 py-3 font-bold text-white disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}

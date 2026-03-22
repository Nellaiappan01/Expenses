"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "@/app/context/ConfigContext";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";

type StockItem = { _id: string; name: string; count: number };

type StockOutRecord = {
  _id: string;
  stockId: string;
  name: string;
  count: number;
  note?: string;
  date: string;
};

export default function StockOutPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [items, setItems] = useState<StockItem[]>([]);
  const [records, setRecords] = useState<StockOutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCount, setEditCount] = useState(1);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (config && !config.features?.stock) {
      router.replace("/");
    }
  }, [config, router]);

  const fetchItems = useCallback(async () => {
    const res = await apiFetch("/api/stock");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0]._id);
    }
  }, [selectedId]);

  const fetchRecords = useCallback(async () => {
    const res = await apiFetch("/api/stock/out?limit=50");
    if (res.ok) {
      const data = await res.json();
      setRecords(data);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchItems(), fetchRecords()]).finally(() => setLoading(false));
  }, [fetchItems, fetchRecords]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedId || count < 1) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/stock/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: selectedId,
          count,
          note: note.trim() || undefined,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCount(1);
        setNote("");
        fetchRecords();
        fetchItems();
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(rec: StockOutRecord) {
    setEditingId(rec._id);
    setEditCount(rec.count);
    setEditNote(rec.note || "");
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
        body: JSON.stringify({ count: editCount, note: editNote.trim() || undefined }),
      });
      if (res.ok) {
        closeEdit();
        fetchRecords();
        fetchItems();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this stock out record? Count will be restored to stock.")) return;
    try {
      const res = await apiFetch(`/api/stock/out/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r._id !== id));
        fetchItems();
        if (editingId === id) closeEdit();
      }
    } catch {
      // ignore
    }
  }

  if (loading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const selectedItem = items.find((i) => i._id === selectedId);
  const maxCount = selectedItem ? selectedItem.count : 0;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-4 pb-28 sm:px-5">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/stock"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Back to Stock"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Stock Out
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Record stock going out
            </p>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No stock items. Add items in Stock Check first.
            </p>
            <Link
              href="/stock"
              className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Go to Stock Check →
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleAdd} className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Stock item
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setCount(1);
                  }}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  required
                >
                  {items.map((i) => (
                    <option key={i._id} value={i._id}>
                      {i.name} (available: {i.count})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Count
                </label>
                <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                  <button
                    type="button"
                    onClick={() => setCount((c) => Math.max(1, c - 1))}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl font-bold text-zinc-700 active:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:active:bg-zinc-600 sm:h-16 sm:w-16 sm:text-3xl"
                  >
                    −
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                      {Math.min(count, maxCount || count)}
                    </span>
                    {maxCount > 0 && (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        max {maxCount}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCount((c) => Math.min(maxCount || 999, c + 1))}
                    disabled={maxCount > 0 && count >= maxCount}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-2xl font-bold text-white active:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:active:bg-emerald-600 sm:h-16 sm:w-16 sm:text-3xl"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason or details (optional)"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={saving || count < 1 || (maxCount > 0 && count > maxCount)}
                className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add Stock Out"}
              </button>
            </form>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Recent records
              </h2>
              {records.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No stock out records yet
                </p>
              ) : (
                <div className="space-y-2">
                  {records.map((rec) => (
                    <div
                      key={rec._id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {rec.name}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {rec.count} out · {formatDateDDMMYYYY(rec.date)}
                          {rec.note ? ` · ${rec.note}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(rec)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                          aria-label="Edit"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec._id)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                          aria-label="Delete"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h0m0 0H8m0 0h8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editingId && (
              <>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                  aria-label="Close"
                />
                <div className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border-t border-zinc-200 bg-white p-4 pb-[env(safe-area-inset-bottom)] dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="mx-auto max-w-md">
                    <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Edit record
                    </h3>
                    <form onSubmit={handleEditSave} className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Count
                        </label>
                        <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <button
                            type="button"
                            onClick={() => setEditCount((c) => Math.max(1, c - 1))}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xl font-bold dark:bg-zinc-700"
                          >
                            −
                          </button>
                          <span className="flex-1 text-center text-2xl font-bold tabular-nums">
                            {editCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditCount((c) => c + 1)}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xl font-bold text-white dark:bg-emerald-500"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Note
                        </label>
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={closeEdit}
                          className="flex-1 rounded-xl border border-zinc-300 py-3 font-medium dark:border-zinc-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editSaving}
                          className="flex-1 rounded-xl bg-emerald-600 py-3 font-medium text-white disabled:opacity-50"
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

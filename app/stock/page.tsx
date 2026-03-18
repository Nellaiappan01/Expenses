"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "@/app/context/ConfigContext";

type StockItem = {
  _id: string;
  name: string;
  count: number;
  valuePerUnit: number;
  lastCheckAt: string | null;
};

type HistoryEntry = {
  _id: string;
  previousCount: number;
  newCount: number;
  difference: number;
  checkDate: string;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UpdateIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

export default function StockPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [items, setItems] = useState<StockItem[]>([]);

  useEffect(() => {
    if (config && !config.features?.stock) {
      router.replace("/");
    }
  }, [config, router]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newCount, setNewCount] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCount, setAddCount] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCount, setEditCount] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchItems = useCallback(async () => {
    const res = await apiFetch("/api/stock");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    }
  }, []);

  useEffect(() => {
    fetchItems().finally(() => setLoading(false));
  }, [fetchItems]);

  async function fetchHistory(id: string) {
    const res = await apiFetch(`/api/stock/${id}/history`);
    if (res.ok) {
      const data = await res.json();
      setHistory(data);
    }
  }

  function openUpdate(item: StockItem) {
    setUpdatingId(item._id);
    setNewCount(String(item.count));
    fetchHistory(item._id);
  }

  function closeUpdate() {
    setUpdatingId(null);
    setNewCount("");
  }

  function openEdit(item: StockItem) {
    setEditingItem(item);
    setEditName(item.name);
    setEditCount(String(item.count));
    setEditValue(String(item.valuePerUnit));
  }

  function closeEdit() {
    setEditingItem(null);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/stock/${editingItem._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          count: Number(editCount) || 0,
          valuePerUnit: Number(editValue) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev.map((i) => (i._id === editingItem._id ? { ...i, ...data } : i))
        );
        if (updatingId === editingItem._id) {
          setUpdatingId(null);
          setNewCount("");
        }
        closeEdit();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingItem || !confirm(`Delete "${editingItem.name}"? This will remove all check history.`)) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/stock/${editingItem._id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i._id !== editingItem._id));
        if (updatingId === editingItem._id) {
          setUpdatingId(null);
          setNewCount("");
        }
        closeEdit();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCheck() {
    if (!updatingId || newCount === "") return;
    const res = await apiFetch(`/api/stock/${updatingId}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: Number(newCount) }),
    });
    if (res.ok) {
      const data = await res.json();
      setHistory((prev) => [
        {
          _id: data._id || Date.now().toString(),
          previousCount: data.previousCount,
          newCount: data.newCount,
          difference: data.difference,
          checkDate: data.lastCheckAt || new Date().toISOString(),
        },
        ...prev,
      ]);
      setItems((prev) =>
        prev.map((i) =>
          i._id === updatingId
            ? { ...i, count: data.newCount, lastCheckAt: data.lastCheckAt }
            : i
        )
      );
      setNewCount(String(data.newCount));
    }
  }

  async function handleDownload(type: "full" | "history") {
    setDownloading(true);
    try {
      const url = type === "history" ? "/api/stock/export?type=history" : "/api/stock/export";
      const res = await apiFetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download =
        type === "history"
          ? `stock-history-${new Date().toISOString().split("T")[0]}.csv`
          : `stock-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } finally {
      setDownloading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    setAddSaving(true);
    try {
      const res = await apiFetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          count: Number(addCount) || 0,
          valuePerUnit: Number(addValue) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [...prev, data]);
        setAddName("");
        setAddCount("");
        setAddValue("");
        setAddOpen(false);
      }
    } finally {
      setAddSaving(false);
    }
  }

  function filterAndSortItems(list: StockItem[], query: string): StockItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return list;

    const tokens = q.split(/\s+/).filter(Boolean);
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

    return list
      .map((item) => {
        const name = normalize(item.name);
        const nameLower = item.name.toLowerCase();
        let score = 0;

        if (name === q) score = 100;
        else if (name.startsWith(q) || nameLower.startsWith(q)) score = 80;
        else if (name.includes(q) || nameLower.includes(q)) score = 60;
        else if (tokens.every((t) => name.includes(t) || nameLower.includes(t))) {
          const matchedTokens = tokens.filter((t) => name.includes(t) || nameLower.includes(t)).length;
          score = 40 + matchedTokens * 5;
        } else {
          const partialMatch = tokens.some((t) => name.includes(t) || nameLower.includes(t));
          if (partialMatch) score = 20;
          else return null;
        }
        return { item, score };
      })
      .filter((x): x is { item: StockItem; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }

  const filteredItems = filterAndSortItems(items, searchQuery);
  const displayItems = [...filteredItems].sort((a, b) => {
    if (a.count === 0 && b.count !== 0) return 1;
    if (a.count !== 0 && b.count === 0) return -1;
    return a.name.localeCompare(b.name);
  });
  const totalValue = filteredItems.reduce((s, i) => s + i.count * i.valuePerUnit, 0);
  const updatingItem = items.find((i) => i._id === updatingId);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-4 pb-28 sm:px-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Stock Check
          </h1>
          <div className="flex items-center gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownload("full")}
                  disabled={downloading}
                  title="Full report (Summary + History)"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <DownloadIcon />
                  <span className="hidden sm:inline">{downloading ? "…" : "Full"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload("history")}
                  disabled={downloading}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  title="Check History only"
                >
                  <DownloadIcon />
                  <span className="hidden sm:inline">{downloading ? "…" : "History"}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(!addOpen)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
              >
                {addOpen ? "Cancel" : "+ Add"}
              </button>
          </div>
        </div>

        {addOpen && (
          <form
            onSubmit={handleAdd}
            className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Add Stock Item
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Stock name"
                required
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={addCount}
                  onChange={(e) => setAddCount(e.target.value.replace(/[^0-9.-]/g, ""))}
                  placeholder="Initial count"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value.replace(/[^0-9.-]/g, ""))}
                  placeholder="Value per unit (₹)"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={addSaving}
                className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {addSaving ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No stock items yet.
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Tap + Add to add your first item.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name (e.g. 7.00 R16, Vihan Lug, 7.50)"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {filteredItems.length} of {items.length} items
                </p>
              )}
            </div>

            <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Total Value{searchQuery ? " (filtered)" : ""}
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                ₹{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No items match &quot;{searchQuery}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
              displayItems.map((item) => (
                <div
                  key={item._id}
                  className={`overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 ${
                    item.count === 0
                      ? "border-red-300 dark:border-red-800"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium ${item.count === 0 ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {item.name}
                      </p>
                      <p className={`text-xs ${item.count === 0 ? "text-red-600 dark:text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                        {item.count} × ₹{item.valuePerUnit.toLocaleString("en-IN")} = ₹
                        {(item.count * item.valuePerUnit).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`text-lg font-semibold tabular-nums ${item.count === 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {item.count}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 active:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
                        aria-label="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => openUpdate(item)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 active:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400"
                        aria-label="Update count"
                      >
                        <UpdateIcon />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (historyOpenId === item._id) {
                        setHistoryOpenId(null);
                      } else {
                        setHistoryOpenId(item._id);
                        fetchHistory(item._id);
                      }
                    }}
                    className="flex w-full items-center justify-between border-t border-zinc-100 px-4 py-2 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <span>
                      Last check:{" "}
                      {item.lastCheckAt
                        ? formatDate(item.lastCheckAt)
                        : "Never"}
                    </span>
                    <svg
                      className={`h-4 w-4 transition-transform ${historyOpenId === item._id ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {historyOpenId === item._id && (
                    <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                      <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        History
                      </p>
                      {history.length === 0 ? (
                        <p className="text-xs text-zinc-400">No checks yet</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {history.map((h) => (
                            <div
                              key={h._id}
                              className="flex justify-between text-xs"
                            >
                              <span className="text-zinc-600 dark:text-zinc-300">
                                {formatDate(h.checkDate)}
                              </span>
                              <span>
                                {h.previousCount} → {h.newCount}
                                <span
                                  className={`ml-1 font-medium ${
                                    h.difference >= 0
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  ({h.difference >= 0 ? "+" : ""}
                                  {h.difference})
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )              ))}
            </div>
          </>
        )}

        {editingItem && (
          <>
            <button
              type="button"
              onClick={closeEdit}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm nav-sheet-backdrop"
              aria-label="Close"
            />
            <div className="nav-sheet fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mx-auto max-w-md px-4 pt-3 pb-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Edit {editingItem.name}
                  </h2>
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleEditSave} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Count
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editCount}
                      onChange={(e) => setEditCount(e.target.value.replace(/[^0-9.-]/g, ""))}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Value per unit (₹)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.-]/g, ""))}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={editSaving || !editName.trim()}
                      className="flex-1 rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={editSaving}
                      className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {updatingId && updatingItem && (
          <>
            <button
              type="button"
              onClick={closeUpdate}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm nav-sheet-backdrop"
              aria-label="Close"
            />
            <div className="nav-sheet fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mx-auto max-w-md px-4 pt-3 pb-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Update {updatingItem.name}
                  </h2>
                  <button
                    type="button"
                    onClick={closeUpdate}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Last check
                    </p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {updatingItem.lastCheckAt
                        ? formatDate(updatingItem.lastCheckAt)
                        : "Never"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Previous count
                    </p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {updatingItem.count}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      New count
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newCount}
                      onChange={(e) =>
                        setNewCount(e.target.value.replace(/[^0-9.-]/g, ""))
                      }
                      placeholder="Enter count"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      autoFocus
                    />
                  </div>
                  {newCount !== "" && (
                    <div>
                      <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Difference
                      </p>
                      <p
                        className={`text-lg font-semibold ${
                          Number(newCount) - updatingItem.count >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {Number(newCount) - updatingItem.count >= 0 ? "+" : ""}
                        {Number(newCount) - updatingItem.count}
                      </p>
                    </div>
                  )}
                  {history.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Recent checks
                      </p>
                      <div className="max-h-24 space-y-1 overflow-y-auto">
                        {history.slice(0, 5).map((h) => (
                          <div
                            key={h._id}
                            className="flex justify-between text-xs"
                          >
                            <span>{formatDate(h.checkDate)}</span>
                            <span>
                              {h.previousCount} → {h.newCount}
                              <span
                                className={
                                  h.difference >= 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }
                              >
                                {" "}
                                ({h.difference >= 0 ? "+" : ""}
                                {h.difference})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCheck}
                    disabled={newCount === ""}
                    className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Save Check
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

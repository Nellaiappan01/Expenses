"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useConfig } from "@/app/context/ConfigContext";
import { useUser } from "@/app/context/UserContext";
import { ShareWhatsAppButton } from "./ShareWhatsAppButton";
import { formatDateTimeDDMMYYYY } from "@/lib/dateFormat";
import { stockLastUserUpdate } from "@/lib/stockLastUpdate";
import { filterAndSortItems, stockStats } from "@/lib/stockFilters";
import type { StockFilter, StockItem, StockSort } from "@/lib/stockTypes";
import { StockThumbnail } from "./StockThumbnail";
import { StockPhotoUploader } from "./StockPhotoUploader";
import { GodownDailyHub } from "./components/GodownDailyHub";
import { EveningCheckPanel } from "./components/EveningCheckPanel";
import { PublicViewLink } from "./components/PublicViewLink";
import { stockHeroUrl } from "@/lib/cloudinaryUrls";
import { uploadStockPhoto } from "@/lib/uploadStockPhoto";

type HistoryEntry = {
  _id: string;
  previousCount: number;
  newCount: number;
  difference: number;
  checkDate: string;
};

const FILTERS: { id: StockFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in_stock", label: "In stock" },
  { id: "empty", label: "Out" },
  { id: "low", label: "Low" },
  { id: "stale", label: "Stale" },
];

const SORT_OPTIONS: { id: StockSort; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "count_desc", label: "Count" },
  { id: "value_desc", label: "Value" },
  { id: "last_check", label: "Recent" },
];

function formatRupee(amount: number): string {
  return amount.toLocaleString("en-IN", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

function formatDate(d: string) {
  return formatDateTimeDDMMYYYY(d);
}

function stockStatus(item: StockItem): "empty" | "low" | "ok" {
  if (item.count === 0) return "empty";
  const min = item.minStock ?? 0;
  if (min > 0 && item.count <= min) return "low";
  return "ok";
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right font-medium text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

export default function StockPage() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const { userName } = useUser();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [sort, setSort] = useState<StockSort>("name");
  const [searchQuery, setSearchQuery] = useState("");
  const [photoCacheBust, setPhotoCacheBust] = useState(0);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newCount, setNewCount] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCount, setAddCount] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addBrand, setAddBrand] = useState("");
  const [addSize, setAddSize] = useState("");
  const [addSku, setAddSku] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addMinStock, setAddMinStock] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addPhotoPreview, setAddPhotoPreview] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCount, setEditCount] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [checkSaving, setCheckSaving] = useState(false);
  const [pageMode, setPageMode] = useState<"daily" | "inventory">("daily");
  const [eveningOpen, setEveningOpen] = useState(false);

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

  function openDetail(item: StockItem) {
    setDetailItem(item);
    fetchHistory(item._id);
  }

  function openUpdate(item: StockItem) {
    setUpdatingId(item._id);
    setNewCount(String(item.count));
    setDetailItem(null);
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
    setEditBrand(item.brand ?? "");
    setEditSize(item.size ?? "");
    setEditSku(item.sku ?? "");
    setEditLocation(item.location ?? "");
    setEditMinStock(item.minStock ? String(item.minStock) : "");
    setEditNotes(item.notes ?? "");
    setEditPhotoPreview(null);
    setDetailItem(null);
  }

  function closeEdit() {
    setEditingItem(null);
    setEditPhotoPreview(null);
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
          brand: editBrand.trim(),
          size: editSize.trim(),
          sku: editSku.trim(),
          location: editLocation.trim(),
          minStock: Number(editMinStock) || 0,
          notes: editNotes.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (editPhotoPreview) {
          const uploaded = await uploadStockPhoto(editingItem._id, editPhotoPreview);
          if (uploaded) {
            data.hasPhoto = true;
            data.photoUrl = uploaded.photoUrl;
            data.photoThumbUrl = uploaded.photoThumbUrl;
          }
          setPhotoCacheBust((n) => n + 1);
        }
        setItems((prev) =>
          prev.map((i) => (i._id === editingItem._id ? { ...i, ...data } : i))
        );
        if (updatingId === editingItem._id) closeUpdate();
        closeEdit();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleRemovePhoto(item: StockItem) {
    const res = await apiFetch(`/api/stock/${item._id}/photo`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? { ...i, hasPhoto: false, photoUrl: undefined, photoThumbUrl: undefined }
            : i
        )
      );
      setPhotoCacheBust((n) => n + 1);
      if (detailItem?._id === item._id) {
        setDetailItem({ ...item, hasPhoto: false, photoUrl: undefined, photoThumbUrl: undefined });
      }
    }
  }

  async function handleDelete() {
    if (!editingItem || !confirm(`Delete "${editingItem.name}"? This will remove all check history.`))
      return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/stock/${editingItem._id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i._id !== editingItem._id));
        if (updatingId === editingItem._id) closeUpdate();
        closeEdit();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCheck() {
    if (!updatingId || newCount === "" || checkSaving) return;
    setCheckSaving(true);
    try {
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
              ? {
                  ...i,
                  count: data.newCount,
                  lastCheckAt: data.lastCheckAt,
                  updatedAt: data.updatedAt ?? data.lastCheckAt,
                }
              : i
          )
        );
        closeUpdate();
      }
    } finally {
      setCheckSaving(false);
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
          brand: addBrand.trim(),
          size: addSize.trim(),
          sku: addSku.trim(),
          location: addLocation.trim(),
          minStock: Number(addMinStock) || 0,
          notes: addNotes.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (addPhotoPreview) {
          const uploaded = await uploadStockPhoto(data._id, addPhotoPreview);
          if (uploaded) {
            data.hasPhoto = true;
            data.photoUrl = uploaded.photoUrl;
            data.photoThumbUrl = uploaded.photoThumbUrl;
          }
          setPhotoCacheBust((n) => n + 1);
        }
        setItems((prev) => [...prev, data]);
        setAddName("");
        setAddCount("");
        setAddValue("");
        setAddBrand("");
        setAddSize("");
        setAddSku("");
        setAddLocation("");
        setAddMinStock("");
        setAddNotes("");
        setAddPhotoPreview(null);
        setAddOpen(false);
      }
    } finally {
      setAddSaving(false);
    }
  }

  const filteredItems = filterAndSortItems(items, searchQuery, filter, sort);
  const stats = stockStats(filteredItems);
  const allStats = stockStats(items);
  const updatingItem = items.find((i) => i._id === updatingId);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/40 via-transparent to-transparent dark:from-emerald-950/20" />
      <div className="relative mx-auto max-w-2xl px-4 py-5 pb-28 sm:px-5">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Godown
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Godown Stock
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <PublicViewLink variant="compact" />
            <button
              type="button"
              onClick={() => setPageMode(pageMode === "daily" ? "inventory" : "daily")}
              className="rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200"
            >
              {pageMode === "daily" ? "All items" : "Daily"}
            </button>
            <Link
              href="/stock/dashboard"
              className="rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200"
            >
              Report
            </Link>
          </div>
        </header>

        <PublicViewLink />

        {pageMode === "inventory" && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(!addOpen)}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {addOpen ? "Cancel" : "+ Add item"}
            </button>
            <button
              type="button"
              onClick={() => handleDownload("full")}
              disabled={downloading}
              className="rounded-xl bg-white px-3 py-2 text-sm text-zinc-600 ring-1 ring-zinc-200"
            >
              Export
            </button>
          </div>
        )}

        {addOpen && pageMode === "inventory" && (
          <form
            onSubmit={handleAdd}
            className="mb-5 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/90 p-5 shadow-xl shadow-zinc-200/50 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-none"
          >
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              New stock item
            </h2>
            <StockPhotoUploader
              variant="hero"
              preview={addPhotoPreview}
              onPreviewChange={setAddPhotoPreview}
              label="Product photo (Cloudinary)"
            />
            <div className="mt-4 space-y-2">
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Name (e.g. 10.00 R20 Amar Gold)"
                required
                className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={addBrand}
                  onChange={(e) => setAddBrand(e.target.value)}
                  placeholder="Brand"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="text"
                  value={addSize}
                  onChange={(e) => setAddSize(e.target.value)}
                  placeholder="Size / spec"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={addCount}
                  onChange={(e) => setAddCount(e.target.value.replace(/[^0-9.-]/g, ""))}
                  placeholder="Count"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value.replace(/[^0-9.-]/g, ""))}
                  placeholder="₹ per unit"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={addSku}
                  onChange={(e) => setAddSku(e.target.value)}
                  placeholder="SKU / code"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="text"
                  value={addLocation}
                  onChange={(e) => setAddLocation(e.target.value)}
                  placeholder="Shelf / location"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={addMinStock}
                onChange={(e) => setAddMinStock(e.target.value.replace(/[^0-9.-]/g, ""))}
                placeholder="Low-stock alert at (optional)"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Notes for client (tread, batch, supplier…)"
                rows={2}
                className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={addSaving}
                className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {addSaving ? "Adding…" : "Add item"}
              </button>
            </div>
          </form>
        )}

        {pageMode === "daily" && items.length > 0 && (
          <GodownDailyHub items={items} onStartCheck={() => setEveningOpen(true)} />
        )}

        {eveningOpen && items.length > 0 && (
          <EveningCheckPanel
            items={items}
            onClose={() => setEveningOpen(false)}
            onSaved={(update) => {
              setItems((prev) =>
                prev.map((i) =>
                  i._id === update.id
                    ? {
                        ...i,
                        count: update.count,
                        lastCheckAt: update.lastCheckAt,
                        updatedAt: update.updatedAt ?? update.lastCheckAt,
                      }
                    : i
                )
              );
            }}
          />
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-14 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">No stock items yet.</p>
            <p className="mt-1 text-xs text-zinc-400">Add items with photos and details for your clients.</p>
          </div>
        ) : (
          <>
            <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 -mx-4 mb-4 border-b border-zinc-200/90 bg-[#f4f4f5]/95 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, brand, size, SKU…"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"} for &ldquo;
                  {searchQuery.trim()}&rdquo;
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      filter === f.id
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] font-bold uppercase text-zinc-400">Sort</span>
                {SORT_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSort(s.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      sort === s.id
                        ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                        : "bg-white text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {pageMode === "inventory" && (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="Units" value={stats.totalCount.toLocaleString("en-IN")} />
                <StatCard
                  label="Value"
                  value={`₹${stats.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                  accent
                />
                <StatCard label="Out of stock" value={String(stats.empty)} warn={stats.empty > 0} />
                <StatCard label="Low stock" value={String(stats.low)} warn={stats.low > 0} />
              </div>
            )}

            <div className="space-y-3 pb-2">
              {filteredItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">No items match your filters.</p>
              ) : (
                filteredItems.map((item) => {
                  const status = stockStatus(item);
                  const lastUpdate = stockLastUserUpdate(item);
                  return (
                    <article
                      key={item._id}
                      className={`relative overflow-hidden rounded-2xl border bg-white/90 shadow-md shadow-zinc-200/40 backdrop-blur dark:bg-zinc-900/90 dark:shadow-none ${
                        status === "empty"
                          ? "border-red-200 dark:border-red-900"
                          : status === "low"
                            ? "border-amber-200 dark:border-amber-900"
                            : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <ShareWhatsAppButton
                        className="absolute left-2 top-2 z-10"
                        shopName={userName ?? undefined}
                        name={item.name}
                        count={item.count}
                        brand={item.brand}
                        size={item.size}
                        photoUrl={item.photoUrl}
                      />
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="flex w-full gap-3 p-3 text-left"
                      >
                        <StockThumbnail
                          stockId={item._id}
                          hasPhoto={item.hasPhoto}
                          photoThumbUrl={item.photoThumbUrl}
                          photoUrl={item.photoUrl}
                          cacheBust={photoCacheBust}
                          className="h-[4.5rem] w-[4.5rem]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                              {item.name}
                            </p>
                            {status === "empty" && <Badge tone="red">Out</Badge>}
                            {status === "low" && <Badge tone="amber">Low</Badge>}
                            {item.hasPhoto && <Badge tone="emerald">Photo</Badge>}
                          </div>
                          {(item.brand || item.size) && (
                            <p className="truncate text-xs text-zinc-500">
                              {[item.brand, item.size].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="rounded-lg bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                Per unit
                              </p>
                              <p className="text-sm font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                                {item.valuePerUnit > 0 ? `₹${formatRupee(item.valuePerUnit)}` : "—"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-zinc-50 px-2.5 py-1 ring-1 ring-zinc-100 dark:bg-zinc-800 dark:ring-zinc-700">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                                Stock value
                              </p>
                              <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                                {item.valuePerUnit > 0
                                  ? `₹${formatRupee(item.count * item.valuePerUnit)}`
                                  : `${item.count} pcs`}
                              </p>
                            </div>
                          </div>
                          {item.valuePerUnit <= 0 && (
                            <p className="mt-1 text-[11px] font-medium text-amber-700">
                              Tap Edit details to set unit price
                            </p>
                          )}
                          {item.location && (
                            <p className="mt-1 text-xs text-zinc-400">📍 {item.location}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end justify-between gap-1">
                          <div className="text-right">
                            <p className="text-[9px] font-bold uppercase text-zinc-400">Qty</p>
                            <span className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                              {item.count}
                            </span>
                          </div>
                          <div className="max-w-[6.5rem] text-right">
                            <p className="text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">
                              Last update
                            </p>
                            <span className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800">
                              {lastUpdate ? formatDate(lastUpdate) : "Not yet"}
                            </span>
                          </div>
                        </div>
                      </button>
                      <div className="flex border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="flex-1 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Edit details
                        </button>
                        <button
                          type="button"
                          onClick={() => openUpdate(item)}
                          className="flex-1 border-l border-zinc-100 py-2.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:border-zinc-800 dark:hover:bg-emerald-950/30"
                        >
                          Stock check
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Detail sheet */}
        {detailItem && (
          <Sheet onClose={() => setDetailItem(null)} title={detailItem.name}>
            <div className="relative mb-4 overflow-hidden rounded-2xl ring-1 ring-zinc-200/80 dark:ring-zinc-700">
              <ShareWhatsAppButton
                className="absolute left-3 top-3 z-10"
                shopName={userName ?? undefined}
                name={detailItem.name}
                count={detailItem.count}
                brand={detailItem.brand}
                size={detailItem.size}
                photoUrl={detailItem.photoUrl}
              />
              <StockThumbnail
                stockId={detailItem._id}
                hasPhoto={detailItem.hasPhoto}
                photoThumbUrl={detailItem.photoThumbUrl}
                photoUrl={detailItem.photoUrl}
                size="hero"
                cacheBust={photoCacheBust}
                className="mx-auto h-52 w-full"
                onClick={() => openEdit(detailItem)}
              />
              {!detailItem.hasPhoto && !detailItem.photoUrl && (
                <p className="bg-zinc-50 py-2 text-center text-xs text-zinc-500 dark:bg-zinc-800">
                  Tap photo area to add image
                </p>
              )}
            </div>
            <div className="mb-4 space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <DetailRow label="Brand" value={detailItem.brand} />
              <DetailRow label="Size" value={detailItem.size} />
              <DetailRow label="SKU" value={detailItem.sku} />
              <DetailRow label="Location" value={detailItem.location} />
              <DetailRow
                label="Min stock alert"
                value={detailItem.minStock ? String(detailItem.minStock) : undefined}
              />
              {detailItem.notes && (
                <p className="border-t border-zinc-200 pt-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  {detailItem.notes}
                </p>
              )}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                <p className="text-xs text-zinc-500">On hand</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {detailItem.count}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-xs text-zinc-500">Line value</p>
                <p className="text-lg font-bold">
                  ₹{(detailItem.count * detailItem.valuePerUnit).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <p className="mb-2 text-xs font-medium text-zinc-500">Check history</p>
            {history.length === 0 ? (
              <p className="text-xs text-zinc-400">No checks yet</p>
            ) : (
              <div className="max-h-36 space-y-2 overflow-y-auto">
                {history.map((h) => (
                  <div key={h._id} className="flex justify-between text-xs">
                    <span>{formatDate(h.checkDate)}</span>
                    <span>
                      {h.previousCount} → {h.newCount}
                      <span
                        className={
                          h.difference >= 0 ? "text-emerald-600" : "text-red-600"
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
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(detailItem)}
                className="flex-1 rounded-xl border py-3 text-sm font-medium"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => openUpdate(detailItem)}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white"
              >
                Check stock
              </button>
            </div>
            {detailItem.hasPhoto && (
              <button
                type="button"
                onClick={() => handleRemovePhoto(detailItem)}
                className="mt-2 w-full text-xs text-red-600"
              >
                Remove photo
              </button>
            )}
          </Sheet>
        )}

        {editingItem && (
          <Sheet onClose={closeEdit} title={`Edit ${editingItem.name}`}>
            <form onSubmit={handleEditSave} className="space-y-3">
              <StockPhotoUploader
                variant="hero"
                preview={editPhotoPreview}
                onPreviewChange={setEditPhotoPreview}
                existingThumbUrl={editingItem.photoThumbUrl}
                existingHeroUrl={
                  editingItem.photoUrl ? stockHeroUrl(editingItem.photoUrl) : undefined
                }
                label="Product photo"
              />
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Name" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Brand" />
                <input type="text" value={editSize} onChange={(e) => setEditSize(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Size" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" inputMode="numeric" value={editCount} onChange={(e) => setEditCount(e.target.value.replace(/[^0-9.-]/g, ""))} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Count" />
                <input type="text" inputMode="decimal" value={editValue} onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.-]/g, ""))} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="₹/unit" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={editSku} onChange={(e) => setEditSku(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="SKU" />
                <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Location" />
              </div>
              <input type="text" inputMode="numeric" value={editMinStock} onChange={(e) => setEditMinStock(e.target.value.replace(/[^0-9.-]/g, ""))} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Low-stock alert at" />
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Notes" />
              <div className="flex gap-2">
                <button type="submit" disabled={editSaving} className="flex-1 rounded-xl bg-emerald-600 py-3 font-medium text-white disabled:opacity-50">
                  {editSaving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={handleDelete} disabled={editSaving} className="rounded-xl border border-red-300 px-4 py-3 text-red-700 dark:border-red-800 dark:text-red-400">
                  Delete
                </button>
              </div>
            </form>
          </Sheet>
        )}

        {updatingId && updatingItem && (
          <Sheet onClose={closeUpdate} title={`Check · ${updatingItem.name}`}>
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Last: {updatingItem.lastCheckAt ? formatDate(updatingItem.lastCheckAt) : "Never"}
              </p>
              <p className="text-3xl font-bold">{updatingItem.count}</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">New count</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value.replace(/[^0-9.-]/g, ""))}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  autoFocus
                />
              </div>
              {newCount !== "" && (
                <p
                  className={`text-lg font-semibold ${
                    Number(newCount) - updatingItem.count >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {Number(newCount) - updatingItem.count >= 0 ? "+" : ""}
                  {Number(newCount) - updatingItem.count}
                </p>
              )}
              <button
                type="button"
                onClick={handleCheck}
                disabled={newCount === "" || checkSaving}
                className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white disabled:opacity-50"
              >
                {checkSaving ? "Saving…" : "Save check"}
              </button>
            </div>
          </Sheet>
        )}
      </div>

    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`text-lg font-bold ${
          warn
            ? "text-amber-600 dark:text-amber-400"
            : accent
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "red" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  const colors = {
    red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${colors[tone]}`}>
      {children}
    </span>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        aria-label="Close"
      />
      <div className="fixed inset-x-0 bottom-0 z-[61] max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-zinc-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/95">
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

"use client";

import {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatDateDDMMYYYY, formatDayMonthName, toLocalDateString } from "@/lib/dateFormat";
import { compressImageFile } from "@/lib/stockTypes";
import { StockThumbnail } from "../StockThumbnail";
import { ShareWhatsAppButton } from "../ShareWhatsAppButton";

export type StockFlowItem = {
  _id: string;
  name: string;
  count: number;
  hasPhoto?: boolean;
  photoThumbUrl?: string;
  photoUrl?: string;
  sku?: string;
  brand?: string;
  size?: string;
};

export type MovementRecord = {
  _id: string;
  stockId: string;
  name: string;
  count: number;
  note?: string;
  date: string;
};

const SWIPE_THRESHOLD = 48;
const LONG_PRESS_MS = 480;

type Theme = {
  ring: string;
  cardPulse: string;
  gradBorder: string;
  gradBtn: string;
  badge: string;
  plusBtn: string;
  accent: string;
  label: string;
};

const THEMES: Record<"in" | "out", Theme> = {
  in: {
    ring: "ring-emerald-400/80",
    cardPulse: "evening-card-active",
    gradBorder: "from-emerald-600 to-teal-600",
    gradBtn: "from-emerald-600 to-teal-600",
    badge: "bg-emerald-100 text-emerald-800",
    plusBtn: "bg-emerald-600",
    accent: "text-emerald-600",
    label: "Qty received",
  },
  out: {
    ring: "ring-red-400/80",
    cardPulse: "evening-card-active-out",
    gradBorder: "from-red-500 to-rose-600",
    gradBtn: "from-red-500 to-rose-600",
    badge: "bg-red-100 text-red-800",
    plusBtn: "bg-red-600",
    accent: "text-red-600",
    label: "Qty going out",
  },
};

function matchesSearch(item: StockFlowItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return false;
  return (
    item.name.toLowerCase().includes(s) ||
    (item.sku?.toLowerCase().includes(s) ?? false) ||
    (item.brand?.toLowerCase().includes(s) ?? false) ||
    (item.size?.toLowerCase().includes(s) ?? false)
  );
}

type Props = {
  mode: "in" | "out";
  items: StockFlowItem[];
  records: MovementRecord[];
  loading?: boolean;
  backHref?: string;
  otherHref: string;
  otherLabel: string;
  initialStockId?: string | null;
  initialQty?: number;
  saving?: boolean;
  error?: string;
  onSave: (params: {
    stockId: string;
    count: number;
    note?: string;
    date: string;
  }) => Promise<boolean>;
  onRecordEdit?: (rec: MovementRecord) => void;
  onRecordDelete?: (id: string) => void;
  shopName?: string;
  onAddProduct?: (payload: {
    name: string;
    count: number;
    valuePerUnit: number;
    photoDataUrl?: string | null;
  }) => Promise<StockFlowItem | null>;
};

export function StockMovementFlow({
  mode,
  items,
  records,
  loading,
  backHref = "/stock",
  otherHref,
  otherLabel,
  initialStockId,
  initialQty,
  saving: savingProp,
  error,
  onSave,
  onRecordEdit,
  onRecordDelete,
  shopName,
  onAddProduct,
}: Props) {
  const theme = THEMES[mode];
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const [index, setIndex] = useState(0);
  const [qty, setQty] = useState(initialQty && initialQty > 0 ? initialQty : 1);
  const [note, setNote] = useState("");
  const [typeMode, setTypeMode] = useState(false);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [countBump, setCountBump] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [query, setQuery] = useState("");
  const [recentOpen, setRecentOpen] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);
  const [entryDate, setEntryDate] = useState(() => toLocalDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCount, setNewCount] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [addProductSaving, setAddProductSaving] = useState(false);
  const [addProductError, setAddProductError] = useState("");
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);
  const newPhotoInputRef = useRef<HTMLInputElement>(null);
  const [portalReady, setPortalReady] = useState(false);

  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const swipeZoneRef = useRef<HTMLDivElement>(null);
  const isHorizontalSwipe = useRef(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const saving = savingProp || savingLocal;
  const current = sorted[index];
  const total = sorted.length;

  useEffect(() => {
    if (!sorted.length) return;
    if (initialStockId) {
      const i = sorted.findIndex((it) => it._id === initialStockId);
      if (i >= 0) setIndex(i);
    }
    if (initialQty && initialQty > 0) setQty(initialQty);
  }, [sorted, initialStockId, initialQty]);

  useEffect(() => {
    if (!pendingJumpId || !sorted.length) return;
    const i = sorted.findIndex((it) => it._id === pendingJumpId);
    if (i >= 0) {
      setIndex(i);
      setPendingJumpId(null);
      setQuery("");
    }
  }, [sorted, pendingJumpId]);

  useEffect(() => {
    setQty(1);
    setTypeMode(false);
    setNote("");
  }, [current?._id]);

  function resetNewProductForm() {
    setNewName("");
    setNewCount("");
    setNewValue("");
    setNewPhoto(null);
    setAddProductError("");
  }

  async function pickNewPhoto(file: File | undefined) {
    if (!file?.type.startsWith("image/")) return;
    setPhotoBusy(true);
    try {
      setNewPhoto(await compressImageFile(file));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submitNewProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!onAddProduct || !newName.trim()) return;
    setAddProductSaving(true);
    setAddProductError("");
    try {
      const item = await onAddProduct({
        name: newName.trim(),
        count: Number(newCount) || 0,
        valuePerUnit: Number(newValue) || 0,
        photoDataUrl: newPhoto,
      });
      if (item) {
        setAddProductOpen(false);
        resetNewProductForm();
        setPendingJumpId(item._id);
      } else {
        setAddProductError("Could not add product. Check name or try again.");
      }
    } catch {
      setAddProductError("Failed to add product");
    } finally {
      setAddProductSaving(false);
    }
  }

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!addProductOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [addProductOpen]);

  useEffect(() => {
    if (typeMode) qtyInputRef.current?.focus();
  }, [typeMode]);

  useEffect(() => {
    const el = swipeZoneRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (isHorizontalSwipe.current) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [current?._id]);

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return sorted
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => matchesSearch(item, q))
      .slice(0, 15);
  }, [sorted, query]);

  const goTo = useCallback(
    (nextIndex: number, dir: "next" | "prev") => {
      if (nextIndex < 0 || nextIndex >= sorted.length) return;
      setSlideDir(dir);
      setIndex(nextIndex);
      setDragX(0);
      setTypeMode(false);
    },
    [sorted.length]
  );

  const goNext = useCallback(() => goTo(index + 1, "next"), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1, "prev"), [goTo, index]);

  function jumpToSearch(itemId: string) {
    const i = sorted.findIndex((it) => it._id === itemId);
    if (i >= 0) {
      goTo(i, i > index ? "next" : "prev");
      setQuery("");
      searchInputRef.current?.blur();
    }
  }

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onSwipeStart(clientX: number, clientY: number) {
    swipeRef.current = { x: clientX, y: clientY };
    isHorizontalSwipe.current = false;
    setDragX(0);
  }

  function onSwipeMove(clientX: number, clientY: number) {
    if (!swipeRef.current) return;
    const dx = clientX - swipeRef.current.x;
    const dy = clientY - swipeRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
      isHorizontalSwipe.current = true;
      setDragX(dx * 0.45);
    }
  }

  function onSwipeEnd(clientX: number) {
    if (!swipeRef.current) return;
    const dx = clientX - swipeRef.current.x;
    swipeRef.current = null;
    isHorizontalSwipe.current = false;
    setDragX(0);
    if (dx < -SWIPE_THRESHOLD) goNext();
    else if (dx > SWIPE_THRESHOLD) goPrev();
  }

  function onQtyPressStart() {
    longPressFiredRef.current = false;
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setTypeMode(true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  }

  function onQtyPressMove(clientX: number, clientY: number, startX: number, startY: number) {
    if (Math.abs(clientX - startX) > 8 || Math.abs(clientY - startY) > 8) {
      clearLongPress();
    }
  }

  function onQtyPressEnd() {
    clearLongPress();
  }

  function bumpQty() {
    setCountBump(true);
    setTimeout(() => setCountBump(false), 260);
  }

  function adjustQty(delta: number) {
    const max = mode === "out" && current ? current.count : 99999;
    setQty((q) => {
      const next = Math.max(1, q + delta);
      return mode === "out" ? Math.min(max || 1, next) : next;
    });
    bumpQty();
  }

  async function handleSave(advance = true) {
    if (!current || qty < 1 || saving) return;
    if (mode === "out" && current.count > 0 && qty > current.count) return;

    setSavingLocal(true);
    try {
      const ok = await onSave({
        stockId: current._id,
        count: qty,
        note: mode === "out" ? note.trim() || undefined : undefined,
        date: entryDate,
      });
      if (ok) {
        setSuccessFlash(true);
        setQty(1);
        setNote("");
        if (navigator.vibrate) navigator.vibrate([8, 40, 8]);
        setTimeout(() => setSuccessFlash(false), 520);
        if (advance && index < sorted.length - 1) goTo(index + 1, "next");
      }
    } finally {
      setSavingLocal(false);
    }
  }

  useEffect(() => {
    if (!slideDir) return;
    const t = setTimeout(() => setSlideDir(null), 400);
    return () => clearTimeout(t);
  }, [slideDir, index]);

  const slideClass =
    slideDir === "next"
      ? "evening-slide-next"
      : slideDir === "prev"
        ? "evening-slide-prev"
        : "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-6">
        <p className="text-center text-zinc-500">No items yet.</p>
        <Link href="/stock" className={`mt-4 font-semibold ${theme.accent}`}>
          Go to Godown Stock →
        </Link>
      </div>
    );
  }

  const maxOut = current?.count ?? 0;
  const godown = current?.count ?? 0;
  const canSave =
    qty >= 1 && (mode === "in" || maxOut === 0 || qty <= maxOut);
  const headerProgress = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;

  return (
    <div className="stock-hub-stagger flex min-h-screen flex-col bg-gradient-to-b from-zinc-100/80 to-white pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-zinc-200/60 bg-white/90 px-4 pb-3 pt-2 backdrop-blur-md">
        <div className="mb-3 flex items-center gap-3">
          <Link
            href={backHref}
            className="shrink-0 rounded-xl p-2 text-zinc-500 ring-1 ring-zinc-200/80 active:scale-95 active:bg-zinc-100"
            aria-label="Back to godown"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${theme.gradBtn} transition-all duration-500`}
              style={{ width: `${headerProgress}%` }}
            />
          </div>
        </div>

        <SearchBlock
          query={query}
          setQuery={setQuery}
          searchInputRef={searchInputRef}
          results={searchResults}
          currentId={current?._id}
          theme={theme}
          mode={mode}
          total={total}
          onPick={jumpToSearch}
        />
      </div>

      {/* Card */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-3">
        {index > 0 && <NavArrow dir="prev" onClick={goPrev} />}
        {index < total - 1 && <NavArrow dir="next" onClick={goNext} />}

        {current && (
          <div
            className={`stock-hub-stagger-1 w-full max-w-sm overflow-hidden rounded-[28px] bg-gradient-to-br ${theme.gradBorder} p-[2px] shadow-xl ${
              mode === "in" ? "shadow-emerald-600/20" : "shadow-red-500/20"
            }`}
          >
          <div
            key={current._id}
            className={`${theme.cardPulse} relative select-none rounded-[26px] bg-white p-5 ${slideClass} ${
              successFlash ? "stock-success-flash" : ""
            }`}
            style={{
              transform: dragX ? `translateX(${dragX}px)` : undefined,
              transition: dragX ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <CardTopActions
              date={entryDate}
              onDateChange={setEntryDate}
              theme={theme}
              dateInputRef={dateInputRef}
              showAddProduct={!!onAddProduct}
              onAddProduct={() => {
                setAddProductError("");
                setAddProductOpen(true);
              }}
            />
            <ShareWhatsAppButton
              className="absolute left-3 top-3 z-10"
              shopName={shopName}
              name={current.name}
              count={current.count}
              brand={current.brand}
              size={current.size}
              photoUrl={current.photoUrl}
            />

            {/* Swipe: photo + name + godown only */}
            <div
              ref={swipeZoneRef}
              className="touch-pan-y cursor-grab active:cursor-grabbing"
              onTouchStart={(e) =>
                onSwipeStart(e.touches[0].clientX, e.touches[0].clientY)
              }
              onTouchMove={(e) =>
                onSwipeMove(e.touches[0].clientX, e.touches[0].clientY)
              }
              onTouchEnd={(e) => onSwipeEnd(e.changedTouches[0].clientX)}
              onMouseDown={(e) => onSwipeStart(e.clientX, e.clientY)}
              onMouseMove={(e) => {
                if (e.buttons === 1) onSwipeMove(e.clientX, e.clientY);
              }}
              onMouseUp={(e) => onSwipeEnd(e.clientX)}
              onMouseLeave={() => {
                swipeRef.current = null;
                isHorizontalSwipe.current = false;
                setDragX(0);
              }}
            >
              <p className="mb-2 text-center text-[10px] font-medium text-zinc-400">
                ← swipe to change item →
              </p>

              <div className="mx-auto mb-4 flex justify-center">
                <StockThumbnail
                  stockId={current._id}
                  hasPhoto={current.hasPhoto}
                  photoThumbUrl={current.photoThumbUrl}
                  photoUrl={current.photoUrl}
                  size="hero"
                  className="h-32 w-32 !rounded-2xl shadow-md ring-2 ring-white"
                />
              </div>

              <h2 className="mb-3 text-center text-xl font-bold leading-snug text-zinc-900">
                {current.name}
              </h2>

              <GodownQtyCard
                mode={mode}
                theme={theme}
                godown={godown}
                qty={qty}
                countBump={countBump}
                typeMode={typeMode}
                maxOut={maxOut}
                qtyInputRef={qtyInputRef}
                onQtyChange={(v) => {
                  const n = parseInt(v.replace(/\D/g, ""), 10);
                  if (!v) setQty(1);
                  else if (!isNaN(n) && n >= 1) {
                    setQty(mode === "out" && maxOut > 0 ? Math.min(n, maxOut) : n);
                  }
                }}
                onTypeDone={() => setTypeMode(false)}
                onPressStart={onQtyPressStart}
                onPressMove={onQtyPressMove}
                onPressEnd={onQtyPressEnd}
                onAdjust={adjustQty}
              />
            </div>

            {mode === "out" && (
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="mt-3 w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-400/40"
              />
            )}
          </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="shrink-0 space-y-2 px-4 pb-3">
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={!canSave || saving}
          className={`w-full rounded-2xl bg-gradient-to-r ${theme.gradBtn} py-4 text-lg font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-50`}
        >
          {saving
            ? "Saving…"
            : mode === "in"
              ? `Add ${qty} Stock In →`
              : `Record ${qty} Stock Out →`}
        </button>
        <p className="text-center text-sm text-zinc-500">
          <Link href={otherHref} className={`font-semibold ${theme.accent}`}>
            {otherLabel}
          </Link>
        </p>
      </div>

      {/* Recent */}
      <RecentSection
        mode={mode}
        records={records}
        open={recentOpen}
        onToggle={() => setRecentOpen((o) => !o)}
        theme={theme}
        onEdit={onRecordEdit}
        onDelete={onRecordDelete}
      />

      {portalReady &&
        addProductOpen &&
        onAddProduct &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-product-title"
          >
            <button
              type="button"
              className="nav-sheet-backdrop absolute inset-0 bg-black/55"
              aria-label="Close"
              onClick={() => {
                if (!addProductSaving) {
                  setAddProductOpen(false);
                  resetNewProductForm();
                }
              }}
            />
            <div className="nav-sheet relative z-10 flex w-full max-w-md max-h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
                <h3 id="new-product-title" className="text-lg font-bold text-zinc-900">
                  New product
                </h3>
                <p className="text-xs text-zinc-500">Photo · name · stock · price</p>
              </div>

              <form
                onSubmit={submitNewProduct}
                className="flex min-h-0 flex-1 flex-col"
                style={{ maxHeight: "min(70dvh, calc(100vh - 12rem))" }}
              >
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
                  <div className="flex gap-2.5">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => newPhotoInputRef.current?.click()}
                        disabled={photoBusy}
                        className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl ring-2 ring-dashed active:scale-[0.98] ${
                          newPhoto
                            ? "ring-emerald-400"
                            : "bg-emerald-50 ring-emerald-200"
                        }`}
                        aria-label="Upload product photo"
                      >
                        {newPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={newPhoto} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <svg
                            className="h-6 w-6 text-emerald-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        )}
                        {photoBusy && (
                          <span className="absolute inset-0 flex items-center justify-center bg-white/80">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                          </span>
                        )}
                      </button>
                      <input
                        ref={newPhotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => void pickNewPhoto(e.target.files?.[0])}
                      />
                      {newPhoto && (
                        <button
                          type="button"
                          onClick={() => setNewPhoto(null)}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-white"
                          aria-label="Remove photo"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-xs font-semibold text-zinc-600">
                        Product name *
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. 10.00 R20 Amar Gold"
                        required
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                      <label className="mb-1 block text-xs font-semibold text-zinc-600">
                        Godown stock
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newCount}
                        onChange={(e) => setNewCount(e.target.value.replace(/\D/g, ""))}
                        placeholder="0"
                        className="w-full bg-transparent text-xl font-bold tabular-nums focus:outline-none"
                      />
                      <p className="text-[11px] text-zinc-500">pcs</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                      <label className="mb-1 block text-xs font-semibold text-emerald-800">
                        Unit price
                      </label>
                      <div className="flex items-center gap-0.5">
                        <span className="font-bold text-emerald-700">₹</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value.replace(/[^0-9.]/g, ""))}
                          placeholder="0"
                          className="min-w-0 flex-1 bg-transparent text-xl font-bold tabular-nums focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-emerald-700/80">per pc</p>
                    </div>
                  </div>

                  {addProductError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {addProductError}
                    </p>
                  )}
                </div>

                <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3">
                  <button
                    type="submit"
                    disabled={addProductSaving || !newName.trim()}
                    className={`w-full min-h-[52px] rounded-2xl text-base font-bold text-white shadow-md active:scale-[0.99] disabled:opacity-50 bg-gradient-to-r ${theme.gradBtn}`}
                  >
                    {addProductSaving ? "Saving…" : "Add to godown"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function CardTopActions({
  date,
  onDateChange,
  theme,
  dateInputRef,
  showAddProduct,
  onAddProduct,
}: {
  date: string;
  onDateChange: (v: string) => void;
  theme: Theme;
  dateInputRef: RefObject<HTMLInputElement | null>;
  showAddProduct: boolean;
  onAddProduct: () => void;
}) {
  return (
    <div
      className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5"
      onTouchStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {showAddProduct && (
        <button
          type="button"
          onClick={onAddProduct}
          className={`flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200/90 active:scale-95 ${theme.accent}`}
          aria-label="Add new product"
          title="New product"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      )}
      <EntryDatePicker
        date={date}
        onChange={onDateChange}
        theme={theme}
        inputRef={dateInputRef}
        inline
      />
    </div>
  );
}

function EntryDatePicker({
  date,
  onChange,
  theme,
  inputRef,
  inline,
}: {
  date: string;
  onChange: (v: string) => void;
  theme: Theme;
  inputRef: RefObject<HTMLInputElement | null>;
  inline?: boolean;
}) {
  const today = toLocalDateString();
  const isToday = date === today;

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  }

  return (
    <div className={inline ? "flex flex-col items-end" : "absolute right-3 top-3 z-10 flex flex-col items-end"}>
      <input
        ref={inputRef}
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />
      <button
        type="button"
        onClick={openPicker}
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 active:scale-95 ${
          isToday ? "ring-zinc-200/90 text-zinc-500" : `${theme.badge} ring-2`
        }`}
        aria-label={`Entry date${isToday ? ", today" : `: ${formatDayMonthName(date)}`}`}
        title="Pick entry date"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>
      {!isToday && (
        <span className={`mt-0.5 text-[9px] font-bold leading-tight ${theme.accent}`}>
          {formatDayMonthName(date)}
        </span>
      )}
    </div>
  );
}

function NavArrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md ring-1 ring-zinc-200/80 active:scale-95 ${
        dir === "prev" ? "left-1" : "right-1"
      }`}
      aria-label={dir === "prev" ? "Previous" : "Next"}
    >
      <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={dir === "prev" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </button>
  );
}

function GodownQtyCard({
  mode,
  theme,
  godown,
  qty,
  countBump,
  typeMode,
  maxOut,
  qtyInputRef,
  onQtyChange,
  onTypeDone,
  onPressStart,
  onPressMove,
  onPressEnd,
  onAdjust,
}: {
  mode: "in" | "out";
  theme: Theme;
  godown: number;
  qty: number;
  countBump: boolean;
  typeMode: boolean;
  maxOut: number;
  qtyInputRef: RefObject<HTMLInputElement | null>;
  onQtyChange: (v: string) => void;
  onTypeDone: () => void;
  onPressStart: () => void;
  onPressMove: (x: number, y: number, sx: number, sy: number) => void;
  onPressEnd: () => void;
  onAdjust: (delta: number) => void;
}) {
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const outerRing = mode === "in" ? "ring-emerald-200/90" : "ring-red-200/90";
  const qtyBg = mode === "in" ? "bg-emerald-50 ring-emerald-100" : "bg-red-50 ring-red-100";
  const qtyLabel = mode === "in" ? "Qty received" : "Qty out";

  return (
    <div className={`rounded-2xl bg-zinc-50/80 p-2 ring-2 ${outerRing} stock-cell-pop`}>
      {typeMode ? (
        <div className="p-2">
          <QtyTypeInput
            ref={qtyInputRef}
            mode={mode}
            value={String(qty)}
            onChange={onQtyChange}
            onDone={onTypeDone}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center justify-center rounded-xl bg-white px-2 py-4 ring-1 ring-zinc-100">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              Godown stock
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums text-zinc-900">{godown}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">in godown</p>
            {godown === 0 && (
              <span className="mt-1 text-[10px] font-semibold text-red-600">Empty</span>
            )}
          </div>

          <div
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-4 ring-1 ${qtyBg}`}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              pressStart.current = { x: t.clientX, y: t.clientY };
              onPressStart();
            }}
            onTouchMove={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              if (pressStart.current) {
                onPressMove(
                  t.clientX,
                  t.clientY,
                  pressStart.current.x,
                  pressStart.current.y
                );
              }
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              pressStart.current = null;
              onPressEnd();
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
              {qtyLabel}
            </p>
            <p
              className={`mt-1 text-4xl font-black tabular-nums ${theme.accent} ${countBump ? "count-bump" : ""}`}
            >
              {qty}
            </p>
            <p className={`mt-0.5 text-[10px] font-medium ${theme.accent}`}>
              long press
            </p>
          </div>
        </div>
      )}

      {!typeMode && (
        <div className="mt-2 flex items-center justify-center gap-3 px-1">
          <button
            type="button"
            onClick={() => onAdjust(-1)}
            className="flex h-12 flex-1 max-w-[80px] items-center justify-center rounded-xl bg-white text-2xl font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200 active:scale-90"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onAdjust(1)}
            disabled={mode === "out" && maxOut > 0 && qty >= maxOut}
            className={`flex h-12 flex-1 max-w-[80px] items-center justify-center rounded-xl text-2xl font-bold text-white shadow-md active:scale-90 disabled:opacity-40 ${theme.plusBtn}`}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function SearchBlock({
  query,
  setQuery,
  searchInputRef,
  results,
  currentId,
  theme,
  mode,
  total,
  onPick,
}: {
  query: string;
  setQuery: (q: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  results: { item: StockFlowItem; i: number }[];
  currentId?: string;
  theme: Theme;
  mode: "in" | "out";
  total: number;
  onPick: (id: string) => void;
}) {
  const focusRing =
    mode === "in" ? "focus:ring-emerald-500/40" : "focus:ring-red-500/40";

  return (
    <div>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={searchInputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${total} items…`}
          className={`w-full rounded-2xl bg-zinc-100 py-3 pl-9 pr-9 text-sm font-medium focus:outline-none focus:ring-2 ${focusRing}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-600"
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>
      {query.trim() ? (
        <ul className="stock-tally-enter mt-2 max-h-44 overflow-y-auto rounded-2xl bg-white py-1 shadow-lg ring-1 ring-zinc-200">
          {results.length === 0 ? (
            <li className="px-4 py-4 text-center text-sm text-zinc-500">No match</li>
          ) : (
            results.map(({ item }, n) => (
              <li key={item._id}>
                <button
                  type="button"
                  onClick={() => onPick(item._id)}
                  className={`stock-list-in flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-zinc-50 ${
                    item._id === currentId ? "bg-emerald-50/80" : ""
                  }`}
                  style={{ animationDelay: `${n * 0.03}s` as CSSProperties["animationDelay"] }}
                >
                  <StockThumbnail
                    stockId={item._id}
                    hasPhoto={item.hasPhoto}
                    photoThumbUrl={item.photoThumbUrl}
                    photoUrl={item.photoUrl}
                    size="thumb"
                    className="!h-10 !w-10 !rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">Godown {item.count}</p>
                  </div>
                  {item._id === currentId && (
                    <span className={`text-[10px] font-bold ${theme.accent}`}>Now</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

const QtyTypeInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onDone: () => void;
    mode: "in" | "out";
  }
>(function QtyTypeInput({ value, onChange, onDone, mode }, ref) {
  const border = mode === "in" ? "border-emerald-400" : "border-red-400";
  return (
    <div className="mb-2">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-2xl border-2 ${border} bg-zinc-50 py-4 text-center text-4xl font-bold tabular-nums focus:outline-none`}
      />
      <button type="button" onClick={onDone} className="mt-2 w-full text-center text-sm text-zinc-500">
        Done typing
      </button>
    </div>
  );
});

function RecentSection({
  mode,
  records,
  open,
  onToggle,
  theme,
  onEdit,
  onDelete,
}: {
  mode: "in" | "out";
  records: MovementRecord[];
  open: boolean;
  onToggle: () => void;
  theme: Theme;
  onEdit?: (rec: MovementRecord) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="shrink-0 border-t border-zinc-100 bg-white/90">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-700"
      >
        <span>
          Recent stock {mode === "in" ? "in" : "out"}{" "}
          <span className={theme.accent}>({records.length})</span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="max-h-52 overflow-y-auto px-4 pb-4">
          {records.length === 0 ? (
            <li className="py-4 text-center text-sm text-zinc-400">No records yet</li>
          ) : (
            records.map((rec, i) => (
              <li
                key={rec._id}
                className="stock-list-in mb-2 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-100"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{rec.name}</p>
                  <p className="text-xs text-zinc-500">
                    {mode === "in" ? "+" : "−"}
                    {rec.count} · {formatDateDDMMYYYY(rec.date)}
                    {rec.note ? ` · ${rec.note}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${theme.badge}`}>
                  {mode === "in" ? "+" : "−"}
                  {rec.count}
                </span>
                {onEdit && onDelete && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(rec)}
                      className="rounded-lg p-1.5 text-zinc-500 active:bg-zinc-200"
                      aria-label="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(rec._id)}
                      className="rounded-lg p-1.5 text-red-500 active:bg-red-50"
                      aria-label="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 011-1h4a1 1 0 011 1v4" />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { scoreStockSearch } from "@/lib/stockSearch";
import type { StockItem } from "@/lib/stockTypes";
import { StockThumbnail } from "../StockThumbnail";

export type EveningCheckSave = {
  id: string;
  count: number;
  lastCheckAt: string;
  updatedAt?: string;
};

type Props = {
  items: StockItem[];
  onClose: () => void;
  onSaved: (update: EveningCheckSave) => void;
};

const SWIPE_THRESHOLD = 48;
const LONG_PRESS_MS = 480;

function isCheckedToday(lastCheckAt: string | null): boolean {
  if (!lastCheckAt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(lastCheckAt) >= today;
}

function sortEveningItems(items: StockItem[], doneIds: Set<string>): StockItem[] {
  const inStock = items.filter((i) => i.count > 0);
  const nilItems = items.filter((i) => i.count === 0);
  const sortGroup = (list: StockItem[]) =>
    [...list].sort((a, b) => {
      const aDone = doneIds.has(a._id);
      const bDone = doneIds.has(b._id);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  return [...sortGroup(inStock), ...sortGroup(nilItems)];
}

function firstUncheckedIndex(items: StockItem[], doneIds: Set<string>): number {
  const sorted = sortEveningItems(items, doneIds);
  const i = sorted.findIndex((it) => !doneIds.has(it._id));
  return i >= 0 ? i : 0;
}

export function EveningCheckPanel({ items, onClose, onSaved }: Props) {
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const item of items) {
      if (isCheckedToday(item.lastCheckAt)) s.add(item._id);
    }
    return s;
  });
  const [index, setIndex] = useState(0);
  const didInitIndex = useRef(false);
  const [draftCount, setDraftCount] = useState("");
  const [typeMode, setTypeMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [justSaved, setJustSaved] = useState(false);
  const [countBump, setCountBump] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | "pending" | "done">("all");
  const [listQuery, setListQuery] = useState("");

  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () => sortEveningItems(items, doneIds),
    [items, doneIds]
  );

  const inStockItems = useMemo(() => items.filter((i) => i.count > 0), [items]);
  const nilItems = useMemo(() => items.filter((i) => i.count === 0), [items]);
  const inStockCount = inStockItems.length;
  const nilCount = nilItems.length;
  const checkedInStock = inStockItems.filter((i) => doneIds.has(i._id)).length;
  const checkedNil = nilItems.filter((i) => doneIds.has(i._id)).length;
  const nilPending = nilItems.filter((i) => !doneIds.has(i._id)).length;

  const current = sorted[index];
  const total = sorted.length;
  const doneCount = doneIds.size;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isNilItem = (current?.count ?? 0) === 0;
  const showNilBanner =
    isNilItem && (index === inStockCount || (index > 0 && sorted[index - 1]?.count > 0));

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return sorted
      .map((item, i) => ({ item, i, score: scoreStockSearch(item, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [sorted, query]);

  useEffect(() => {
    if (!items.length || didInitIndex.current) return;
    didInitIndex.current = true;
    setIndex(firstUncheckedIndex(items, doneIds));
  }, [items, doneIds]);

  useEffect(() => {
    if (!current) return;
    setDraftCount(String(current.count));
    setTypeMode(false);
  }, [current?._id]);

  useEffect(() => {
    if (index >= sorted.length && sorted.length > 0) {
      setIndex(Math.max(0, sorted.length - 1));
    }
  }, [index, sorted.length]);

  useEffect(() => {
    if (typeMode) inputRef.current?.focus();
  }, [typeMode]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function jumpToItem(itemId: string) {
    const i = sorted.findIndex((it) => it._id === itemId);
    if (i >= 0) {
      goTo(i, i > index ? "next" : "prev");
      setSearchOpen(false);
      setQuery("");
      setListOpen(false);
      setListQuery("");
    }
  }

  const listEntries = useMemo(() => {
    const q = listQuery.trim();
    return sorted
      .map((item, i) => ({ item, i, score: q ? scoreStockSearch(item, q) : 1 }))
      .filter(({ item, score }) => {
        if (listFilter === "pending" && doneIds.has(item._id)) return false;
        if (listFilter === "done" && !doneIds.has(item._id)) return false;
        if (q && score <= 0) return false;
        return true;
      })
      .sort((a, b) => (q ? b.score - a.score : 0));
  }, [sorted, listFilter, doneIds, listQuery]);

  function jumpToNil() {
    const i = sorted.findIndex((it) => it.count === 0 && !doneIds.has(it._id));
    if (i >= 0) goTo(i, i > index ? "next" : "prev");
  }

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

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onPointerDown(clientX: number, clientY: number) {
    longPressFiredRef.current = false;
    touchRef.current = { x: clientX, y: clientY, t: Date.now() };
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setTypeMode(true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(clientX: number, clientY: number) {
    if (!touchRef.current) return;
    const dx = clientX - touchRef.current.x;
    const dy = clientY - touchRef.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress();
    if (!longPressFiredRef.current && Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx * 0.55);
    }
  }

  function onPointerUp(clientX: number) {
    clearLongPress();
    if (!touchRef.current) return;
    const dx = clientX - touchRef.current.x;
    touchRef.current = null;
    setDragX(0);

    if (longPressFiredRef.current) return;

    if (dx < -SWIPE_THRESHOLD) goNext();
    else if (dx > SWIPE_THRESHOLD) goPrev();
  }

  function bumpCount() {
    setCountBump(true);
    setTimeout(() => setCountBump(false), 260);
  }

  function adjustCount(delta: number) {
    setDraftCount((c) => String(Math.max(0, Number(c || 0) + delta)));
    bumpCount();
  }

  async function saveCheck(advance = true) {
    if (!current || draftCount === "" || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/stock/${current._id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(draftCount) }),
      });
      if (res.ok) {
        const data = await res.json();
        const newDone = new Set(doneIds).add(current._id);
        setDoneIds(newDone);
        setJustSaved(true);
        onSaved({
          id: current._id,
          count: data.newCount ?? Number(draftCount),
          lastCheckAt: data.lastCheckAt ?? new Date().toISOString(),
          updatedAt: data.updatedAt ?? data.lastCheckAt ?? new Date().toISOString(),
        });
        if (navigator.vibrate) navigator.vibrate([8, 40, 8]);
        setTimeout(() => setJustSaved(false), 520);
        if (advance) {
          const nextUnchecked = sorted.findIndex(
            (it, i) => i > index && !newDone.has(it._id)
          );
          if (nextUnchecked >= 0) goTo(nextUnchecked, "next");
          else if (index < sorted.length - 1) goTo(index + 1, "next");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const slideClass =
    slideDir === "next"
      ? "evening-slide-next"
      : slideDir === "prev"
        ? "evening-slide-prev"
        : "";

  useEffect(() => {
    if (!slideDir) return;
    const t = setTimeout(() => setSlideDir(null), 400);
    return () => clearTimeout(t);
  }, [slideDir, index]);

  if (!current) {
    return (
      <>
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm nav-sheet-backdrop"
          aria-label="Close"
        />
        <div className="nav-sheet fixed inset-0 z-[71] flex flex-col items-center justify-center bg-white p-6">
          <p className="text-lg font-semibold text-emerald-700">Stock check complete</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-2xl bg-emerald-600 px-8 py-3 font-bold text-white"
          >
            Close
          </button>
        </div>
      </>
    );
  }

  const countNum = Number(draftCount || 0);
  const diff = countNum - current.count;
  const isDone = doneIds.has(current._id);

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm nav-sheet-backdrop"
        aria-label="Close"
      />
      <div className="nav-sheet fixed inset-0 z-[71] flex flex-col bg-gradient-to-b from-zinc-50 to-white">
        {/* Header */}
        <div className="shrink-0 border-b border-zinc-100/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-500 active:bg-zinc-100"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setListOpen((o) => !o);
                setSearchOpen(false);
              }}
              className={`rounded-xl px-3 py-1 text-center active:scale-[0.98] ${
                listOpen ? "bg-emerald-100 ring-2 ring-emerald-400" : "active:bg-zinc-100"
              }`}
              aria-label="Open item list"
              aria-expanded={listOpen}
            >
              <p className="text-sm font-bold text-zinc-800">
                {index + 1} / {total}
              </p>
              <p className="text-[10px] font-medium text-zinc-500">
                <span className="text-emerald-600">
                  {checkedInStock}/{inStockCount} stock
                </span>
                {nilCount > 0 && (
                  <>
                    {" · "}
                    <span className="text-amber-700">
                      {checkedNil}/{nilCount} nil
                    </span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold text-emerald-600">
                {listOpen ? "Hide list" : "Tap for list"}
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen((o) => !o);
                if (searchOpen) setQuery("");
              }}
              className={`rounded-xl p-2 active:bg-zinc-100 ${
                searchOpen ? "bg-emerald-100 text-emerald-700" : "text-zinc-500"
              }`}
              aria-label="Search items"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {nilPending > 0 && !searchOpen && (
            <button
              type="button"
              onClick={jumpToNil}
              className="mt-2 w-full rounded-xl bg-amber-50 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200 active:scale-[0.98]"
            >
              Jump to nil items ({nilPending} left) →
            </button>
          )}

          {searchOpen && (
            <div className="stock-tally-enter mt-3">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find item by name, SKU…"
                  className="w-full rounded-xl bg-zinc-100 py-2.5 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 hover:text-zinc-600"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {query.trim() && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-zinc-200">
                  {searchResults.length === 0 ? (
                    <li className="px-4 py-3 text-center text-sm text-zinc-500">No match</li>
                  ) : (
                    searchResults.map(({ item, i }, n) => {
                      const done = doneIds.has(item._id);
                      return (
                        <li key={item._id}>
                          <button
                            type="button"
                            onClick={() => jumpToItem(item._id)}
                            className={`stock-list-in flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-emerald-50 ${
                              item._id === current._id ? "bg-emerald-50" : ""
                            }`}
                            style={{ animationDelay: `${n * 0.03}s` }}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                done ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-600"
                              }`}
                            >
                              {done ? "✓" : item.count === 0 ? "nil" : item.count}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                              {item.name}
                            </span>
                            {item._id === current._id && (
                              <span className="text-[10px] font-bold text-emerald-600">Now</span>
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          )}

          {!searchOpen && !listOpen && (
            <p className="mt-2 text-center text-[11px] text-zinc-400">
              Tap 1/{total} for list · Swipe ← → · Long press count · 🔍 search
            </p>
          )}
        </div>

        {/* Full item list (tap 1/N) */}
        {listOpen && (
          <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-100 bg-white px-4 py-3">
            <input
              type="search"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Find in list…"
              className="mb-2 w-full rounded-xl bg-zinc-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["pending", "Pending"],
                  ["done", "Checked"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setListFilter(key)}
                  className={`rounded-lg py-1.5 text-[10px] font-bold uppercase ${
                    listFilter === key
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pb-2">
              {listEntries.length === 0 ? (
                <li className="py-8 text-center text-sm text-zinc-500">No items</li>
              ) : (
                listEntries.map(({ item, i }) => {
                  const done = doneIds.has(item._id);
                  const isCurrent = item._id === current._id;
                  return (
                    <li key={item._id}>
                      <button
                        type="button"
                        onClick={() => jumpToItem(item._id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-emerald-50 ${
                          isCurrent ? "bg-emerald-50 ring-2 ring-emerald-400" : "ring-1 ring-zinc-100"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            done
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-zinc-400 ring-2 ring-zinc-300"
                          }`}
                          aria-hidden
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-900">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            #{i + 1}
                            {item.count === 0 ? " · nil" : ` · ${item.count} pcs`}
                          </span>
                        </span>
                        {isCurrent && (
                          <span className="shrink-0 text-[10px] font-bold text-emerald-600">
                            Now
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        {/* Card area */}
        <div
          className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-2 ${
            listOpen ? "hidden" : ""
          }`}
        >
          {index > 0 && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-1 z-10 rounded-full bg-white/90 p-2 shadow-md ring-1 ring-zinc-200/80 active:scale-95"
              aria-label="Previous item"
            >
              <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {index < total - 1 && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-1 z-10 rounded-full bg-white/90 p-2 shadow-md ring-1 ring-zinc-200/80 active:scale-95"
              aria-label="Next item"
            >
              <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div
            key={current._id}
            className={`w-full max-w-sm touch-pan-y select-none rounded-3xl bg-white p-5 ring-2 ${slideClass} ${
              isNilItem
                ? "evening-card-active-out ring-amber-300/90"
                : "evening-card-active ring-emerald-400/80"
            } ${justSaved ? "stock-success-flash" : ""}`}
            style={{
              transform: dragX ? `translateX(${dragX}px)` : undefined,
              transition: dragX ? "none" : "transform 0.25s ease-out",
            }}
            onTouchStart={(e) => onPointerDown(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => onPointerMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={(e) => onPointerUp(e.changedTouches[0].clientX)}
            onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
            onMouseMove={(e) => {
              if (e.buttons === 1) onPointerMove(e.clientX, e.clientY);
            }}
            onMouseUp={(e) => onPointerUp(e.clientX)}
            onMouseLeave={() => {
              clearLongPress();
              touchRef.current = null;
              setDragX(0);
            }}
          >
            {showNilBanner && (
              <p className="evening-check-pop mb-2 rounded-xl bg-amber-50 py-2 text-center text-xs font-bold text-amber-900 ring-1 ring-amber-200">
                Out of stock — confirm nil (0)
              </p>
            )}

            {isDone && (
              <span className="evening-check-pop mb-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                ✓ Checked
              </span>
            )}

            <div className="mx-auto mb-3 flex justify-center">
              <StockThumbnail
                stockId={current._id}
                hasPhoto={current.hasPhoto}
                photoThumbUrl={current.photoThumbUrl}
                photoUrl={current.photoUrl}
                size="hero"
                className="h-28 w-28 !rounded-2xl"
              />
            </div>

            <h3 className="mb-4 text-center text-lg font-bold leading-snug text-zinc-900">
              {current.name}
            </h3>

            {typeMode ? (
              <div className="mb-2">
                <p className="mb-2 text-center text-xs font-medium text-emerald-700">
                  Type count (keyboard)
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draftCount}
                  onChange={(e) => setDraftCount(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 py-4 text-center text-4xl font-bold tabular-nums text-zinc-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setTypeMode(false)}
                  className="mt-2 w-full text-center text-sm font-medium text-zinc-500"
                >
                  Done typing
                </button>
              </div>
            ) : (
              <div
                className={`mb-2 rounded-2xl py-3 ring-1 ${
                  isNilItem
                    ? "bg-amber-50/90 ring-amber-200"
                    : "bg-zinc-50/80 ring-zinc-100"
                }`}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchMove={(e) => {
                  e.stopPropagation();
                  onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  onPointerUp(e.changedTouches[0].clientX);
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {isNilItem ? "Godown (nil)" : "Godown count"}
                </p>
                <p
                  className={`text-center text-5xl font-black tabular-nums ${
                    isNilItem && draftCount === "0"
                      ? "text-amber-700"
                      : "text-zinc-900"
                  } ${countBump ? "count-bump" : ""}`}
                >
                  {draftCount === ""
                    ? "—"
                    : isNilItem && draftCount === "0"
                      ? "Nil"
                      : draftCount}
                </p>
                <p
                  className={`text-center text-xs ${isNilItem ? "text-amber-700" : "text-emerald-600"}`}
                >
                  {isNilItem ? "Not in godown — tap Nil OK below" : "Long press to type"}
                </p>
              </div>
            )}

            {!typeMode && !isNilItem && (
              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    adjustCount(-1);
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-2xl font-bold text-zinc-700 active:scale-90"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    adjustCount(1);
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-lg active:scale-90"
                >
                  +
                </button>
              </div>
            )}

            {diff !== 0 && draftCount !== "" && (
              <p
                className={`mt-3 text-center text-sm font-bold ${
                  diff > 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {diff > 0 ? "+" : ""}
                {diff} from saved
              </p>
            )}
          </div>

        </div>

        {/* Actions */}
        <div
          className={`shrink-0 border-t border-zinc-100 bg-white/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur ${
            listOpen ? "hidden" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => saveCheck(true)}
            disabled={saving || draftCount === ""}
            className={`w-full rounded-2xl py-4 text-lg font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-50 ${
              isNilItem
                ? "bg-gradient-to-r from-amber-500 to-amber-600"
                : "bg-gradient-to-r from-emerald-600 to-teal-600"
            }`}
          >
            {saving
              ? "Saving…"
              : isNilItem
                ? "Nil OK (0) — next →"
                : diff !== 0
                  ? "Save count & next →"
                  : "Count OK — next →"}
          </button>
        </div>
      </div>
    </>
  );
}

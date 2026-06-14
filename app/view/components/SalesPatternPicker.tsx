"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SalesPatternOption = {
  id: string;
  name: string;
  brand: string;
  pcs: number;
  count: number;
};

type Props = {
  options: SalesPatternOption[];
  value: string;
  onChange: (id: string) => void;
};

export function SalesPatternPicker({ options, value, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onDocPointer(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.brand.toLowerCase().includes(q)
    );
  }, [options, query]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearSelection() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div
        className={`relative flex items-center rounded-2xl bg-white ring-1 transition ${
          open ? "ring-2 ring-violet-300 shadow-sm" : "ring-violet-200/90"
        }`}
      >
        <svg
          className="pointer-events-none absolute left-3.5 h-4 w-4 text-violet-400"
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
          ref={inputRef}
          type="search"
          value={open ? query : selected?.name ?? ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search pattern, brand…"
          className="w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-20 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
        />
        <div className="absolute right-2 flex items-center gap-0.5">
          {(value || query) && (
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
              aria-label="Clear pattern"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              if (!open) inputRef.current?.focus();
            }}
            className="rounded-lg p-1.5 text-violet-500 transition hover:bg-violet-50"
            aria-label={open ? "Close pattern list" : "Open pattern list"}
          >
            <svg
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[min(52vh,320px)] overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(91,33,182,0.14)] ring-1 ring-violet-100">
          <ul className="max-h-[min(52vh,320px)] overflow-y-auto overscroll-contain py-1.5 scroll-smooth">
            {!query.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-violet-50 ${
                    !value ? "bg-violet-50/80" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">All patterns</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-violet-600">
                    Show all
                  </span>
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3.5 py-8 text-center text-sm text-slate-500">No pattern matches</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => pick(o.id)}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-violet-50 active:bg-violet-100/80 ${
                      value === o.id ? "bg-violet-50 ring-1 ring-inset ring-violet-100" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{o.name}</p>
                      {o.brand ? (
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{o.brand}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-extrabold tabular-nums text-red-600">
                        {o.pcs} pcs
                      </p>
                      <p className="text-[10px] font-medium text-slate-400">
                        {o.count} {o.count === 1 ? "sale" : "sales"}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

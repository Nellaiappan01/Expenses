"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SearchableDropdownProps = {
  label?: string;
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  addNewLabel: string;
  required?: boolean;
  enterKeyHint?: "next" | "done" | "search";
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  labelClassName?: string;
  inputClassName?: string;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function OptionList({
  listId,
  filtered,
  showAddNew,
  query,
  value,
  addNewLabel,
  onSelect,
  onAddNew,
  className,
}: {
  listId: string;
  filtered: string[];
  showAddNew: boolean;
  query: string;
  value: string;
  addNewLabel: string;
  onSelect: (opt: string) => void;
  onAddNew: () => void;
  className?: string;
}) {
  return (
    <ul id={listId} role="listbox" className={className}>
      {showAddNew && (
        <li>
          <button
            type="button"
            role="option"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onAddNew}
            className="flex w-full min-h-[48px] items-center gap-2 px-4 py-3 text-left text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100"
          >
            <span className="text-lg leading-none">+</span>
            <span className="truncate">
              {addNewLabel.replace(/^\+?\s*/, "")}: &ldquo;{query.trim()}&rdquo;
            </span>
          </button>
        </li>
      )}
      {filtered.map((opt) => (
        <li key={opt}>
          <button
            type="button"
            role="option"
            aria-selected={opt === value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(opt)}
            className={`flex w-full min-h-[48px] items-center px-4 py-3 text-left text-base transition-colors hover:bg-zinc-50 active:bg-zinc-100 ${
              opt === value ? "bg-emerald-50 font-medium text-emerald-800" : "text-zinc-800"
            }`}
          >
            <span className="truncate">{opt}</span>
          </button>
        </li>
      ))}
      {filtered.length === 0 && !showAddNew && (
        <li className="px-4 py-6 text-center text-sm text-zinc-500">No matches</li>
      )}
    </ul>
  );
}

export default function SearchableDropdown({
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  placeholder = "Type to search…",
  addNewLabel,
  required,
  enterKeyHint = "next",
  onEnter,
  inputRef: externalRef,
  labelClassName,
  inputClassName,
}: SearchableDropdownProps) {
  const listId = useId();
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetSearchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open || !isMobile) return;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => sheetSearchRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(timer);
    };
  }, [open, isMobile]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = options.filter((opt) => opt.toLowerCase().includes(normalizedQuery));
  const exactMatch = options.some((opt) => opt.toLowerCase() === normalizedQuery);
  const showAddNew = normalizedQuery.length > 0 && !exactMatch;
  const hasOptions = filtered.length > 0 || showAddNew;
  const displayLabel = label ?? placeholder;

  function selectOption(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  }

  function handleAddNew() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setQuery(trimmed);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showAddNew && filtered.length === 0) {
        handleAddNew();
      } else if (filtered.length === 1) {
        selectOption(filtered[0]);
      } else if (exactMatch) {
        setOpen(false);
      }
      onEnter?.();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function openPicker() {
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
    if (query.trim() && !value) {
      onChange(query.trim());
    }
  }

  useEffect(() => {
    if (isMobile) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (query.trim() && !value) {
          onChange(query.trim());
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, query, value, onChange]);

  const inputClasses =
    inputClassName ??
    "w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:bg-zinc-50 focus:ring-2 focus:ring-emerald-500/30 [font-size:16px]";

  const mobileSheet =
    mounted &&
    isMobile &&
    open &&
    createPortal(
      <div className="fixed inset-0 z-[80] flex flex-col justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/45"
          aria-label="Close options"
          onClick={closePicker}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={displayLabel}
          className="relative z-[81] flex max-h-[min(72dvh,520px)] flex-col rounded-t-2xl bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <div className="flex shrink-0 justify-center pt-2.5 pb-1">
            <div className="h-1 w-10 rounded-full bg-zinc-300" aria-hidden />
          </div>
          <div className="shrink-0 border-b border-zinc-100 px-4 pb-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900">{displayLabel}</p>
              <button
                type="button"
                onClick={closePicker}
                className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
              >
                Done
              </button>
            </div>
            <input
              ref={sheetSearchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onChange(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              enterKeyHint={enterKeyHint}
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 [font-size:16px]"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y">
            <OptionList
              listId={`${listId}-sheet`}
              filtered={filtered}
              showAddNew={showAddNew}
              query={query}
              value={value}
              addNewLabel={addNewLabel}
              onSelect={selectOption}
              onAddNew={handleAddNew}
            />
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div ref={containerRef} className="relative min-w-0">
      {!hideLabel && label ? (
        <label
          className={
            labelClassName ?? "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          }
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={displayLabel}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          value={query}
          readOnly={isMobile}
          onChange={(e) => {
            if (isMobile) return;
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (isMobile) {
              openPicker();
              inputRef.current?.blur();
            } else {
              setOpen(true);
            }
          }}
          onClick={() => {
            if (isMobile) openPicker();
          }}
          onKeyDown={isMobile ? undefined : handleKeyDown}
          placeholder={placeholder}
          required={required}
          enterKeyHint={enterKeyHint}
          autoComplete="off"
          className={`${inputClasses} ${isMobile ? "cursor-pointer pr-9" : ""}`}
        />
        {isMobile && (
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>
      {!isMobile && open && hasOptions && (
        <OptionList
          listId={listId}
          filtered={filtered}
          showAddNew={showAddNew}
          query={query}
          value={value}
          addNewLabel={addNewLabel}
          onSelect={selectOption}
          onAddNew={handleAddNew}
          className="dropdown-enter absolute z-30 mt-1 max-h-52 w-full overflow-y-auto overscroll-contain rounded-xl bg-white py-1 shadow-lg ring-1 ring-zinc-200/80"
        />
      )}
      {mobileSheet}
    </div>
  );
}

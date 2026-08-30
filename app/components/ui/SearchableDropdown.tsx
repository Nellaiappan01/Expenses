"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SearchableDropdownProps = {
  label?: string;
  hideLabel?: boolean;
  leadingIcon?: React.ReactNode;
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

function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return height;
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
            className="flex w-full min-h-[48px] items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-[#0B4A8C] transition-colors active:bg-[#E8F2FA]"
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
            className={`flex w-full min-h-[48px] items-center px-4 py-3 text-left text-base transition-colors active:bg-[#E8F2FA] ${
              opt === value ? "bg-[#E8F2FA] font-semibold text-[#0B4A8C]" : "text-[#0B4A8C]"
            }`}
          >
            <span className="truncate">{opt}</span>
          </button>
        </li>
      ))}
      {filtered.length === 0 && !showAddNew && (
        <li className="px-4 py-8 text-center text-sm text-[#7A9BB8]">No matches</li>
      )}
    </ul>
  );
}

export default function SearchableDropdown({
  label,
  hideLabel = false,
  leadingIcon,
  value,
  onChange,
  options,
  placeholder = "Tap to choose…",
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
  const viewportHeight = useVisualViewportHeight();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [searchActive, setSearchActive] = useState(false);
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
    setSearchActive(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (searchActive && open) {
      sheetSearchRef.current?.focus();
    }
  }, [searchActive, open]);

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
    setSearchActive(false);
  }

  function handleAddNew() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setQuery(trimmed);
    setOpen(false);
    setSearchActive(false);
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
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setQuery(value);
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
    setSearchActive(false);
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

  const embeddedFieldClasses = leadingIcon
    ? `${inputClasses} flex items-center gap-2 !px-3 focus-within:border-[rgba(11,74,140,0.22)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(11,74,140,0.1)]`
    : inputClasses;

  const embeddedInputClasses = leadingIcon
    ? "min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-faint)] [font-size:16px]"
    : inputClasses;

  const sheetMaxHeight =
    viewportHeight != null ? `${Math.min(viewportHeight * 0.88, 560)}px` : "min(88dvh, 560px)";

  const mobileSheet =
    mounted &&
    isMobile &&
    open &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex flex-col justify-end"
        style={viewportHeight != null ? { height: viewportHeight, top: window.visualViewport?.offsetTop ?? 0 } : undefined}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="Close options"
          onClick={closePicker}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={displayLabel}
          className="relative z-[201] flex flex-col rounded-t-2xl bg-white shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ maxHeight: sheetMaxHeight }}
        >
          <div className="flex shrink-0 justify-center pt-2.5 pb-1">
            <div className="h-1 w-10 rounded-full bg-[#D6E6F5]" aria-hidden />
          </div>

          <div className="shrink-0 border-b border-[#D6E6F5] px-4 pb-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#0B4A8C]">{displayLabel}</p>
              <button
                type="button"
                onClick={closePicker}
                className="rounded-lg bg-[#E8F2FA] px-3 py-1.5 text-xs font-bold text-[#0B4A8C]"
              >
                Done
              </button>
            </div>

            {searchActive ? (
              <input
                ref={sheetSearchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  onChange(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Search ${displayLabel.toLowerCase()}…`}
                enterKeyHint={enterKeyHint}
                autoComplete="off"
                className="w-full rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-base text-[#0B4A8C] outline-none focus:border-[#0B4A8C] [font-size:16px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setSearchActive(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-left text-sm text-[#7A9BB8]"
              >
                <SearchIcon className="h-4 w-4 shrink-0" />
                <span>Search or type new…</span>
              </button>
            )}
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

      {isMobile ? (
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={openPicker}
          className={`relative flex w-full items-center justify-between gap-2 text-left ${embeddedFieldClasses} cursor-pointer pr-9`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={displayLabel}
        >
          {leadingIcon ? (
            <span className="shrink-0 text-[#0B4A8C]" aria-hidden>
              {leadingIcon}
            </span>
          ) : null}
          <span
            className={`min-w-0 flex-1 truncate ${value ? "text-[#0B4A8C]" : "text-[#9BB5CC]"}`}
          >
            {value || placeholder}
          </span>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A9BB8]">
            <ChevronIcon />
          </span>
        </button>
      ) : (
        <div className={`relative ${leadingIcon ? embeddedFieldClasses : ""}`}>
          {leadingIcon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[#0B4A8C]" aria-hidden>
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={displayLabel}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required={required}
            enterKeyHint={enterKeyHint}
            autoComplete="off"
            className={leadingIcon ? `${embeddedInputClasses} pl-9 pr-3` : inputClasses}
          />
        </div>
      )}

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

      {/* Hidden input for form validation on mobile — do not open sheet on programmatic focus */}
      {isMobile && required ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          required
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          onChange={() => {}}
        />
      ) : null}

      {mobileSheet}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

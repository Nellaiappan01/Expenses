"use client";

import { useEffect, useId, useRef, useState } from "react";

type SearchableDropdownProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  addNewLabel: string;
  required?: boolean;
  enterKeyHint?: "next" | "done" | "search";
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export default function SearchableDropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Type to search…",
  addNewLabel,
  required,
  enterKeyHint = "next",
  onEnter,
  inputRef: externalRef,
}: SearchableDropdownProps) {
  const listId = useId();
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(normalizedQuery)
  );
  const exactMatch = options.some(
    (opt) => opt.toLowerCase() === normalizedQuery
  );
  const showAddNew = normalizedQuery.length > 0 && !exactMatch;

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

  useEffect(() => {
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
  }, [query, value, onChange]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
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
        className="w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:bg-zinc-50 focus:ring-2 focus:ring-emerald-500/30 [font-size:16px]"
      />
      {open && (filtered.length > 0 || showAddNew) && (
        <ul
          id={listId}
          role="listbox"
          className="dropdown-enter absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-zinc-200/80"
        >
          {showAddNew && (
            <li>
              <button
                type="button"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddNew}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100"
              >
                <span className="text-lg leading-none">+</span>
                {addNewLabel.replace(/^\+?\s*/, "")}: &ldquo;{query.trim()}&rdquo;
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
                onClick={() => selectOption(opt)}
                className={`w-full px-4 py-3 text-left text-base transition-colors hover:bg-zinc-50 active:bg-zinc-100 ${
                  opt === value ? "bg-emerald-50 font-medium text-emerald-800" : "text-zinc-800"
                }`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

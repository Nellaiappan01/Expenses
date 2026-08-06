"use client";

import { useState } from "react";

export default function EditableListSection({
  title,
  description,
  placeholder,
  items,
  onChange,
  readOnlyItems = [],
}: {
  title: string;
  description?: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnlyItems?: string[];
}) {
  const [newValue, setNewValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  function addItem() {
    const v = newValue.trim();
    if (!v) return;
    const exists = items.some((i) => i.toLowerCase() === v.toLowerCase());
    if (exists) {
      setNewValue("");
      return;
    }
    onChange([...items, v].sort((a, b) => a.localeCompare(b)));
    setNewValue("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditValue(items[index]);
  }

  function saveEdit(index: number) {
    const v = editValue.trim();
    if (!v) {
      removeItem(index);
      return;
    }
    const duplicate = items.some(
      (item, i) => i !== index && item.toLowerCase() === v.toLowerCase()
    );
    if (duplicate) {
      setEditingIndex(null);
      return;
    }
    const next = [...items];
    next[index] = v;
    onChange(next.sort((a, b) => a.localeCompare(b)));
    setEditingIndex(null);
  }

  const allItems = [
    ...readOnlyItems.map((label) => ({ label, readonly: true as const })),
    ...items.map((label) => ({ label, readonly: false as const })),
  ].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      {description && (
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      )}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          placeholder={placeholder}
          className="flex-1 rounded-xl bg-zinc-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
        <button
          type="button"
          onClick={addItem}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Add
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {allItems.length === 0 && (
          <li className="py-2 text-center text-xs text-zinc-400">No items yet</li>
        )}
        {allItems.map(({ label, readonly }) => {
          if (readonly) {
            return (
              <li
                key={`ro-${label}`}
                className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5"
              >
                <span className="text-sm text-zinc-600">{label}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  Default
                </span>
              </li>
            );
          }

          const index = items.indexOf(label);
          const isEditing = editingIndex === index;

          return (
            <li
              key={`${label}-${index}`}
              className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2"
            >
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(index);
                      if (e.key === "Escape") setEditingIndex(null);
                    }}
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(index)}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(null)}
                    className="rounded-lg px-2 py-1.5 text-xs text-zinc-500"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(index)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                    aria-label="Edit"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

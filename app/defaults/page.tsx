"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function DefaultsPage() {
  const [names, setNames] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/defaults")
      .then((r) => r.ok ? r.json() : { names: [], notes: [] })
      .then((d) => {
        setNames(d.names ?? []);
        setNotes(d.notes ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch("/api/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names, notes }),
      });
      if (res.ok) {
        // Saved
      }
    } catch {
      // Error
    } finally {
      setSaving(false);
    }
  }

  function addName() {
    const v = newName.trim();
    if (v && !names.includes(v)) {
      setNames([...names, v]);
      setNewName("");
    }
  }

  function removeName(i: number) {
    setNames(names.filter((_, j) => j !== i));
  }

  function addNote() {
    const v = newNote.trim();
    if (v && !notes.includes(v)) {
      setNotes([...notes, v]);
      setNewNote("");
    }
  }

  function removeNote(i: number) {
    setNotes(notes.filter((_, j) => j !== i));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-6 pb-24 sm:px-5">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Defaults
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Save default names and notes for quick entry
            </p>
          </div>
        </header>

        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Default Names
            </h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Shown in Add Entry dropdown. Manual names are not added here.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addName())}
                placeholder="Add name"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <button
                type="button"
                onClick={addName}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Add
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {names.map((n, i) => (
                <li
                  key={`${n}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                >
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{n}</span>
                  <button
                    type="button"
                    onClick={() => removeName(i)}
                    className="text-zinc-400 hover:text-red-500"
                    aria-label="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Default Notes
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNote())}
                placeholder="Add note"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <button
                type="button"
                onClick={addNote}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Add
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {notes.map((n, i) => (
                <li
                  key={`${n}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                >
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{n}</span>
                  <button
                    type="button"
                    onClick={() => removeNote(i)}
                    className="text-zinc-400 hover:text-red-500"
                    aria-label="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Defaults"}
          </button>
        </div>
      </div>
    </div>
  );
}

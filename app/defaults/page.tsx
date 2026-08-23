"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";
import ExpensePeopleSection from "../components/defaults/ExpensePeopleSection";
import { TrashIcon } from "../components/EditEntrySheet";
import type { ExpensePerson } from "@/lib/types";
import { sanitizeExpensePerson } from "@/lib/expensePeople";

function fieldClass() {
  return "min-w-0 flex-1 rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-sm text-[#0B4A8C] outline-none transition-colors placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
}

function DefaultsListSection({
  title,
  hint,
  placeholder,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  title: string;
  hint?: string;
  placeholder: string;
  items: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-[#0B4A8C]">{title}</h2>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-[#5A7FA5]">{hint}</p> : null}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className={fieldClass()}
        />
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 rounded-xl bg-[#0B4A8C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083A6E]"
        >
          Add
        </button>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#D6E6F5] bg-[#F8FBFE] py-1 pl-3 pr-1.5 text-sm text-[#0B4A8C]"
            >
              <span className="truncate">{item}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                aria-label={`Remove ${item}`}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-[#9BB5CC]">No items yet — add one above.</p>
      )}
    </section>
  );
}

type DefaultsState = {
  expenseCategories: string[];
  expenseNames: string[];
  expensePeople: ExpensePerson[];
  approverNames: string[];
  expenseTags: string[];
  workerNames: string[];
  workerCategories: string[];
  notes: string[];
  banks: string[];
};

const EMPTY: DefaultsState = {
  expenseCategories: [],
  expenseNames: [],
  expensePeople: [],
  approverNames: [],
  expenseTags: [],
  workerNames: [],
  workerCategories: [],
  notes: [],
  banks: [],
};

export default function DefaultsPage() {
  const { config } = useConfig() ?? {};
  const businessLabel = config?.branding?.appName || "Your business";

  const [data, setData] = useState<DefaultsState>(EMPTY);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const setDraft = (key: string, value: string) => {
    setDrafts((d) => ({ ...d, [key]: value }));
  };

  const loadDefaults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/defaults");
      const d = res.ok ? await res.json() : EMPTY;
      setData({
        expenseCategories: d.expenseCategories ?? [],
        expenseNames: d.expenseNames ?? [],
        expensePeople: d.expensePeople ?? [],
        approverNames: d.approverNames ?? [],
        expenseTags: d.expenseTags ?? [],
        workerNames: d.workerNames ?? [],
        workerCategories: d.workerCategories ?? [],
        notes: d.notes ?? [],
        banks: d.banks ?? [],
      });
    } catch {
      setError("Could not load defaults.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults]);

type StringListField = Exclude<keyof DefaultsState, "expensePeople">;

  function addItem(field: StringListField, draftKey: string) {
    const v = (drafts[draftKey] ?? "").trim();
    if (!v) return;
    setData((prev) => {
      const list = prev[field] as string[];
      if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return prev;
      return { ...prev, [field]: [...list, v] };
    });
    setDraft(draftKey, "");
  }

  function removeItem(field: StringListField, index: number) {
    setData((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }));
  }

  function addExpensePerson() {
    const v = (drafts.expenseName ?? "").trim();
    if (!v) return;
    const person = sanitizeExpensePerson({ name: v, preferredMethod: "cash", cashOk: true });
    if (!person) return;
    setData((prev) => {
      if (prev.expensePeople.some((p) => p.nameLower === person.nameLower)) return prev;
      const expensePeople = [...prev.expensePeople, person];
      return {
        ...prev,
        expensePeople,
        expenseNames: expensePeople.map((p) => p.name),
      };
    });
    setDraft("expenseName", "");
  }

  function removeExpensePerson(index: number) {
    setData((prev) => {
      const expensePeople = prev.expensePeople.filter((_, i) => i !== index);
      return {
        ...prev,
        expensePeople,
        expenseNames: expensePeople.map((p) => p.name),
      };
    });
  }

  function updateExpensePeople(expensePeople: ExpensePerson[]) {
    setData((prev) => ({
      ...prev,
      expensePeople,
      expenseNames: expensePeople.map((p) => p.name),
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || "Save failed");
      setData({
        expenseCategories: saved.expenseCategories ?? [],
        expenseNames: saved.expenseNames ?? [],
        expensePeople: saved.expensePeople ?? [],
        approverNames: saved.approverNames ?? [],
        expenseTags: saved.expenseTags ?? [],
        workerNames: saved.workerNames ?? [],
        workerCategories: saved.workerCategories ?? [],
        notes: saved.notes ?? [],
        banks: saved.banks ?? [],
      });
      setMessage("Defaults saved — entry form updated.");
      window.dispatchEvent(new Event("defaults-updated"));
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F4F8FC]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B4A8C] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8FC]">
      <div className="mx-auto w-full max-w-md px-4 py-6 pb-28">
        <header className="mb-5 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D6E6F5] bg-white text-[#0B4A8C] shadow-sm"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#0B4A8C]">Defaults</h1>
            <p className="truncate text-sm text-[#5A7FA5]">{businessLabel}</p>
          </div>
        </header>

        <p className="mb-4 rounded-xl border border-[#D6E6F5] bg-white px-3 py-2.5 text-xs leading-relaxed text-[#5A7FA5]">
          Add items below, then tap <strong className="font-semibold text-[#0B4A8C]">Save defaults</strong>.
          Changes apply to your expense form after saving.
        </p>

        <div className="space-y-3">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#7A9BB8]">
            Expense entry form
          </p>

          <DefaultsListSection
            title="Categories"
            hint="Shown in the Category field on the expense form."
            placeholder="Add category"
            items={data.expenseCategories}
            draft={drafts.category ?? ""}
            onDraftChange={(v) => setDraft("category", v)}
            onAdd={() => addItem("expenseCategories", "category")}
            onRemove={(i) => removeItem("expenseCategories", i)}
          />

          <ExpensePeopleSection
            people={data.expensePeople}
            draft={drafts.expenseName ?? ""}
            onDraftChange={(v) => setDraft("expenseName", v)}
            onAdd={addExpensePerson}
            onChange={updateExpensePeople}
            onRemove={removeExpensePerson}
          />

          <DefaultsListSection
            title="Approved by"
            hint="Approvers for expense entries."
            placeholder="Add approver"
            items={data.approverNames}
            draft={drafts.approver ?? ""}
            onDraftChange={(v) => setDraft("approver", v)}
            onAdd={() => addItem("approverNames", "approver")}
            onRemove={(i) => removeItem("approverNames", i)}
          />

          <DefaultsListSection
            title="Tags"
            hint="Optional tags on expense entries (comma-separated on form)."
            placeholder="Add tag"
            items={data.expenseTags}
            draft={drafts.tag ?? ""}
            onDraftChange={(v) => setDraft("tag", v)}
            onAdd={() => addItem("expenseTags", "tag")}
            onRemove={(i) => removeItem("expenseTags", i)}
          />

          <DefaultsListSection
            title="Quick notes"
            hint="Suggested notes you can pick when entering expenses."
            placeholder="Add note"
            items={data.notes}
            draft={drafts.note ?? ""}
            onDraftChange={(v) => setDraft("note", v)}
            onAdd={() => addItem("notes", "note")}
            onRemove={(i) => removeItem("notes", i)}
          />

          <p className="pt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#7A9BB8]">
            Wallet
          </p>

          <DefaultsListSection
            title="Bank accounts"
            hint="Used when Wallet add/withdraw payment is Bank A/c."
            placeholder="Add bank name"
            items={data.banks}
            draft={drafts.bank ?? ""}
            onDraftChange={(v) => setDraft("bank", v)}
            onAdd={() => addItem("banks", "bank")}
            onRemove={(i) => removeItem("banks", i)}
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 text-sm font-medium text-[#0B4A8C]" role="status">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B4A8C] py-3.5 text-base font-bold text-white transition-colors hover:bg-[#083A6E] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save defaults"}
        </button>
      </div>
    </div>
  );
}

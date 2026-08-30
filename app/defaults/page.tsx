"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";
import ExpensePeopleSection from "../components/defaults/ExpensePeopleSection";
import ExpenseNotesSection from "../components/defaults/ExpenseNotesSection";
import { DefaultsAccordionCard } from "../components/defaults/DefaultsAccordionCard";
import { TrashIcon } from "../components/EditEntrySheet";
import type { ExpensePerson } from "@/lib/types";
import { sanitizeExpensePerson } from "@/lib/expensePeople";
import { normalizeExpenseNotes, sanitizeNoteAmount, type ExpenseNoteDefault } from "@/lib/expenseNotes";
import { moveItem } from "@/lib/reorder";
import { GripIcon, useRowDragReorder } from "../components/defaults/rowDragReorder";

function fieldClass() {
  return "min-w-0 flex-1 rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-sm text-[#0B4A8C] outline-none transition-colors placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
}

function DefaultsListSection({
  hint,
  placeholder,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  onReorder,
}: {
  hint?: string;
  placeholder: string;
  items: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onReorder?: (from: number, to: number) => void;
}) {
  const { dragHandleProps } = useRowDragReorder((from, to) => onReorder?.(from, to), items.length);

  return (
    <div>
      {hint ? <p className="mb-3 text-xs leading-relaxed text-[#5A7FA5]">{hint}</p> : null}
      <div className="flex gap-2">
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
        onReorder ? (
          <ul className="mt-3 space-y-2">
            {items.map((item, i) => (
              <li
                key={`${item}-${i}`}
                className="flex items-center gap-1.5 rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] py-1.5 pl-1.5 pr-1.5"
              >
                <button
                  type="button"
                  className="flex h-9 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-[#7A9BB8] active:bg-[#E8F2FC]"
                  aria-label={`Drag ${item}`}
                  {...dragHandleProps(i)}
                >
                  <GripIcon />
                </button>
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => onReorder(i, i - 1)}
                    className="flex h-4 w-7 items-center justify-center rounded text-[#0B4A8C] disabled:opacity-25"
                    aria-label={`Move ${item} up`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={i === items.length - 1}
                    onClick={() => onReorder(i, i + 1)}
                    className="flex h-4 w-7 items-center justify-center rounded text-[#0B4A8C] disabled:opacity-25"
                    aria-label={`Move ${item} down`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B4A8C]">{item}</span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                  aria-label={`Remove ${item}`}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
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
        )
      ) : (
        <p className="mt-3 text-xs text-[#9BB5CC]">No items yet — add one above.</p>
      )}
    </div>
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
  notes: ExpenseNoteDefault[];
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
  const { config, refresh } = useConfig() ?? {};
  const businessLabel = config?.branding?.appName || "Your business";

  const [data, setData] = useState<DefaultsState>(EMPTY);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [driveFolderUrl, setDriveFolderUrl] = useState("");

  function toggleCard(id: string) {
    setOpenCard((current) => (current === id ? null : id));
  }

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
        notes: normalizeExpenseNotes(d.notes),
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

  useEffect(() => {
    setDriveFolderUrl(config?.integrations?.googleDriveFolderUrl ?? "");
  }, [config?.integrations?.googleDriveFolderUrl]);

type StringListField = Exclude<keyof DefaultsState, "expensePeople" | "notes">;

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

  function addExpenseNote() {
    const label = (drafts.note ?? "").trim();
    if (!label) return;
    const amount = sanitizeNoteAmount(drafts.noteAmount);
    setData((prev) => {
      if (prev.notes.some((n) => n.label.toLowerCase() === label.toLowerCase())) return prev;
      return { ...prev, notes: [...prev.notes, amount ? { label, amount } : { label }] };
    });
    setDraft("note", "");
    setDraft("noteAmount", "");
  }

  function removeExpenseNote(index: number) {
    setData((prev) => ({
      ...prev,
      notes: prev.notes.filter((_, i) => i !== index),
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
      const settingsRes = await apiFetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleDriveFolderUrl: driveFolderUrl.trim() }),
      });
      const settingsData = await settingsRes.json().catch(() => ({}));
      if (!settingsRes.ok) throw new Error(settingsData.error || "Drive folder save failed");
      if (settingsData.integrations?.googleDriveFolderUrl !== undefined) {
        setDriveFolderUrl(settingsData.integrations.googleDriveFolderUrl);
      }
      refresh?.();
      setData({
        expenseCategories: saved.expenseCategories ?? [],
        expenseNames: saved.expenseNames ?? [],
        expensePeople: saved.expensePeople ?? [],
        approverNames: saved.approverNames ?? [],
        expenseTags: saved.expenseTags ?? [],
        workerNames: saved.workerNames ?? [],
        workerCategories: saved.workerCategories ?? [],
        notes: normalizeExpenseNotes(saved.notes),
        banks: saved.banks ?? [],
      });
      setMessage("Defaults saved — entry form updated.");
      window.dispatchEvent(new Event("ledger-defaults-updated"));
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

          <DefaultsAccordionCard
            title="Categories"
            icon="category"
            count={data.expenseCategories.length}
            open={openCard === "categories"}
            onToggle={() => toggleCard("categories")}
          >
            <DefaultsListSection
              hint="Shown in the Category field on the expense form. Drag or use the arrows to reorder."
              placeholder="Add category"
              items={data.expenseCategories}
              draft={drafts.category ?? ""}
              onDraftChange={(v) => setDraft("category", v)}
              onAdd={() => addItem("expenseCategories", "category")}
              onRemove={(i) => removeItem("expenseCategories", i)}
              onReorder={(from, to) =>
                setData((prev) => ({
                  ...prev,
                  expenseCategories: moveItem(prev.expenseCategories, from, to),
                }))
              }
            />
          </DefaultsAccordionCard>

          <DefaultsAccordionCard
            title="Requested by"
            icon="people"
            count={data.expensePeople.length}
            open={openCard === "people"}
            onToggle={() => toggleCard("people")}
          >
            <ExpensePeopleSection
              people={data.expensePeople}
              draft={drafts.expenseName ?? ""}
              onDraftChange={(v) => setDraft("expenseName", v)}
              onAdd={addExpensePerson}
              onChange={updateExpensePeople}
              onRemove={removeExpensePerson}
            />
          </DefaultsAccordionCard>

          <DefaultsAccordionCard
            title="Approved by"
            icon="approver"
            count={data.approverNames.length}
            open={openCard === "approvers"}
            onToggle={() => toggleCard("approvers")}
          >
            <DefaultsListSection
              hint="Approvers for expense entries."
              placeholder="Add approver"
              items={data.approverNames}
              draft={drafts.approver ?? ""}
              onDraftChange={(v) => setDraft("approver", v)}
              onAdd={() => addItem("approverNames", "approver")}
              onRemove={(i) => removeItem("approverNames", i)}
            />
          </DefaultsAccordionCard>

          <DefaultsAccordionCard
            title="Expense notes"
            icon="notes"
            count={data.notes.length}
            open={openCard === "notes"}
            onToggle={() => toggleCard("notes")}
          >
            <ExpenseNotesSection
              notes={data.notes}
              draftLabel={drafts.note ?? ""}
              draftAmount={drafts.noteAmount ?? ""}
              onDraftLabelChange={(v) => setDraft("note", v)}
              onDraftAmountChange={(v) => setDraft("noteAmount", v)}
              onAdd={addExpenseNote}
              onChange={(notes) => setData((prev) => ({ ...prev, notes }))}
              onRemove={removeExpenseNote}
            />
          </DefaultsAccordionCard>

          <p className="pt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#7A9BB8]">
            Receipts
          </p>

          <DefaultsAccordionCard
            title="Google Drive folder"
            icon="drive"
            count={driveFolderUrl.trim() ? 1 : 0}
            open={openCard === "drive"}
            onToggle={() => toggleCard("drive")}
          >
            <p className="mb-3 text-xs leading-relaxed text-[#5A7FA5]">
              Paste your own Drive folder URL. Each attachment is saved in a new folder named like the
              entry date — for example <span className="font-semibold text-[#0B4A8C]">01 Aug 2026</span>.
              Redeploy the latest Apps Script from Settings so Drive can create folders.
            </p>
            <input
              type="url"
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className={fieldClass()}
              aria-label="Google Drive folder URL"
            />
          </DefaultsAccordionCard>

          <p className="pt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#7A9BB8]">
            Wallet
          </p>

          <DefaultsAccordionCard
            title="Bank accounts"
            icon="bank"
            count={data.banks.length}
            open={openCard === "banks"}
            onToggle={() => toggleCard("banks")}
          >
            <DefaultsListSection
              hint="Used when Wallet add/withdraw payment is Bank A/c."
              placeholder="Add bank name"
              items={data.banks}
              draft={drafts.bank ?? ""}
              onDraftChange={(v) => setDraft("bank", v)}
              onAdd={() => addItem("banks", "bank")}
              onRemove={(i) => removeItem("banks", i)}
            />
          </DefaultsAccordionCard>
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

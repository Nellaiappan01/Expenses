"use client";

import { GripIcon, useRowDragReorder } from "./rowDragReorder";
import { moveItem } from "@/lib/reorder";
import { TrashIcon } from "../EditEntrySheet";
import type { ExpenseNoteDefault } from "@/lib/expenseNotes";
import { formatNoteAmountInput, sanitizeNoteAmount } from "@/lib/expenseNotes";

function fieldClass() {
  return "min-w-0 flex-1 rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-sm text-[#0B4A8C] outline-none transition-colors placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
}

export default function ExpenseNotesSection({
  notes,
  draftLabel,
  draftAmount,
  onDraftLabelChange,
  onDraftAmountChange,
  onAdd,
  onChange,
  onRemove,
}: {
  notes: ExpenseNoteDefault[];
  draftLabel: string;
  draftAmount: string;
  onDraftLabelChange: (v: string) => void;
  onDraftAmountChange: (v: string) => void;
  onAdd: () => void;
  onChange: (notes: ExpenseNoteDefault[]) => void;
  onRemove: (index: number) => void;
}) {
  const { dragHandleProps } = useRowDragReorder((from, to) => onChange(moveItem(notes, from, to)), notes.length);

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-[#5A7FA5]">
        Add a note and an optional amount, then Save defaults. Drag the handle to reorder. Tapping the
        note on Home fills the amount — you can still change it.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={draftLabel}
          onChange={(e) => onDraftLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Add expense note"
          className={fieldClass()}
        />
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={draftAmount}
            onChange={(e) => onDraftAmountChange(e.target.value.replace(/[^\d.]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="Amount"
            aria-label="Default amount"
            className={`${fieldClass()} sm:w-28`}
          />
          <button
            type="button"
            onClick={onAdd}
            className="shrink-0 rounded-xl bg-[#0B4A8C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083A6E]"
          >
            Add
          </button>
        </div>
      </div>
      {notes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {notes.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              className="flex items-center gap-1.5 rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] py-1.5 pl-1.5 pr-1.5"
            >
              <button
                type="button"
                className="flex h-9 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-[#7A9BB8] active:bg-[#E8F2FC]"
                aria-label={`Drag ${item.label}`}
                {...dragHandleProps(i)}
              >
                <GripIcon />
              </button>
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => onChange(moveItem(notes, i, i - 1))}
                  className="flex h-4 w-7 items-center justify-center rounded text-[#0B4A8C] disabled:opacity-25"
                  aria-label={`Move ${item.label} up`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={i === notes.length - 1}
                  onClick={() => onChange(moveItem(notes, i, i + 1))}
                  className="flex h-4 w-7 items-center justify-center rounded text-[#0B4A8C] disabled:opacity-25"
                  aria-label={`Move ${item.label} down`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B4A8C]">
                {item.label}
              </span>
              <span className="text-xs font-semibold text-[#7A9BB8]">₹</span>
              <input
                type="text"
                inputMode="decimal"
                value={formatNoteAmountInput(item.amount)}
                onChange={(e) => {
                  const next = [...notes];
                  const amount = sanitizeNoteAmount(e.target.value.replace(/[^\d.]/g, ""));
                  next[i] = amount ? { label: item.label, amount } : { label: item.label };
                  onChange(next);
                }}
                placeholder="—"
                aria-label={`${item.label} default amount`}
                className="w-[5.5rem] rounded-lg border border-[#D6E6F5] bg-white px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-[#0B4A8C] outline-none [font-size:16px]"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                aria-label={`Remove ${item.label}`}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-[#9BB5CC]">No notes yet — add one above.</p>
      )}
    </div>
  );
}

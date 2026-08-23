"use client";

import { useEffect, useState } from "react";
import type { ExpensePerson, ExpensePersonPreferredMethod } from "@/lib/types";
import { expensePersonPaymentSummary } from "@/lib/expensePeople";
import { TrashIcon } from "../EditEntrySheet";

function fieldClass() {
  return "w-full rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-2.5 text-sm text-[#0B4A8C] outline-none transition-colors placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
}

const METHODS: { id: ExpensePersonPreferredMethod; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "gpay", label: "GPay" },
  { id: "bank", label: "Bank" },
];

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="rounded-full bg-[#EEF5FC] px-2 py-0.5 text-[10px] font-semibold text-[#0B4A8C]">
      {method}
    </span>
  );
}

function VerifiedBadge({ verified, label }: { verified: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        verified
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
          : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
      }`}
    >
      {verified ? (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
        </svg>
      )}
      {label}
    </span>
  );
}

export default function ExpensePeopleSection({
  people,
  draft,
  onDraftChange,
  onAdd,
  onChange,
  onRemove,
}: {
  people: ExpensePerson[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onChange: (people: ExpensePerson[]) => void;
  onRemove: (index: number) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [prevCount, setPrevCount] = useState(people.length);

  useEffect(() => {
    if (people.length > prevCount) {
      const latest = people[people.length - 1];
      if (latest) setExpandedKey(latest.nameLower);
    }
    setPrevCount(people.length);
  }, [people, prevCount]);

  function updatePerson(index: number, patch: Partial<ExpensePerson>) {
    onChange(people.map((person, i) => (i === index ? { ...person, ...patch } : person)));
  }

  function handleAdd() {
    onAdd();
  }

  return (
    <section className="rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-[#0B4A8C]">Requested by</h2>
      <p className="mt-1 text-xs leading-relaxed text-[#5A7FA5]">
        Tap a name to add or edit payment details. Save defaults when finished.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add name (e.g. Arjun)"
          className={`min-w-0 flex-1 ${fieldClass()}`}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="shrink-0 rounded-xl bg-[#0B4A8C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083A6E]"
        >
          Add
        </button>
      </div>

      {people.length === 0 ? (
        <p className="mt-3 text-xs text-[#9BB5CC]">No people yet — add one above.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {people.map((person, index) => {
            const isExpanded = expandedKey === person.nameLower;
            const summary = expensePersonPaymentSummary(person);
            const method = person.preferredMethod ?? "cash";

            return (
              <li
                key={`${person.nameLower}-${index}`}
                className="overflow-hidden rounded-xl border border-[#D6E6F5] bg-[#F8FBFE]"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedKey(isExpanded ? null : person.nameLower)
                    }
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#0B4A8C]">{person.name}</p>
                      {!isExpanded && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <MethodBadge method={summary.methodLabel} />
                          <VerifiedBadge verified={summary.verified} label={summary.verifiedLabel} />
                        </div>
                      )}
                    </div>
                    <svg
                      className={`h-4 w-4 shrink-0 text-[#7A9BB8] transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (expandedKey === person.nameLower) setExpandedKey(null);
                      onRemove(index);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                    aria-label={`Delete ${person.name}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#D6E6F5] px-3 py-3">
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      <MethodBadge method={summary.methodLabel} />
                      <VerifiedBadge verified={summary.verified} label={summary.verifiedLabel} />
                    </div>

                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A9BB8]">
                      Preferred payment
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      {METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            updatePerson(index, {
                              preferredMethod: m.id,
                              cashOk: m.id === "cash",
                            })
                          }
                          className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                            method === m.id
                              ? m.id === "gpay"
                                ? "border-[#4285F4] bg-[#E8F1FE] text-[#1A5FD4]"
                                : m.id === "bank"
                                  ? "border-[#0B4A8C] bg-[#EEF5FC] text-[#0B4A8C]"
                                  : "border-amber-400 bg-amber-50 text-amber-900"
                              : "border-[#D6E6F5] bg-white text-[#5A7FA5]"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {method === "gpay" && (
                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-[#5A7FA5]">UPI ID</label>
                        <input
                          type="text"
                          value={person.upiId ?? ""}
                          onChange={(e) => updatePerson(index, { upiId: e.target.value })}
                          placeholder="name@upi"
                          className={fieldClass()}
                        />
                      </div>
                    )}

                    {method === "bank" && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#5A7FA5]">
                            Account holder
                          </label>
                          <input
                            type="text"
                            value={person.accountHolder ?? ""}
                            onChange={(e) => updatePerson(index, { accountHolder: e.target.value })}
                            placeholder="Name on account"
                            className={fieldClass()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#5A7FA5]">
                            Account number
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={person.bankAccount ?? ""}
                            onChange={(e) => updatePerson(index, { bankAccount: e.target.value })}
                            placeholder="1234567890"
                            className={fieldClass()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#5A7FA5]">IFSC</label>
                          <input
                            type="text"
                            value={person.ifsc ?? ""}
                            onChange={(e) =>
                              updatePerson(index, { ifsc: e.target.value.toUpperCase() })
                            }
                            placeholder="SBIN0001234"
                            className={fieldClass()}
                          />
                        </div>
                      </div>
                    )}

                    {method === "cash" && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Cash payment — admin will pay in hand to {person.name}.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedKey(null)}
                      className="mt-4 w-full rounded-xl bg-[#0B4A8C] py-2.5 text-sm font-semibold text-white hover:bg-[#083A6E]"
                    >
                      Done
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { amountInWords } from "@/lib/amountInWords";
import { isNetworkFailure, queueOfflineEntry } from "@/lib/offlineEntryQueue";
import { notifyLedgerDataChanged } from "@/lib/clientDataCache";
import type { PaymentMethod } from "@/lib/types";
import { toLocalDateString } from "@/lib/dateFormat";
import SearchableDropdown from "../ui/SearchableDropdown";
import DdMmYyyyDateInput from "../ui/DdMmYyyyDateInput";
import AttachmentUploader from "./AttachmentUploader";
import { formatNoteAmountInput, normalizeExpenseNotes, type ExpenseNoteDefault } from "@/lib/expenseNotes";
import CategoryGlyph from "../CategoryGlyph";
import { getCategoryVisual } from "@/lib/categoryVisuals";

function todayISO() {
  return toLocalDateString();
}

function fieldClass() {
  return "ui-input";
}

function embeddedFieldClass() {
  return `${fieldClass()} flex items-center gap-2 !px-3 focus-within:border-[rgba(11,74,140,0.22)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(11,74,140,0.1)]`;
}

export default function ExpenseEntryForm({
  onSuccess,
  refreshTrigger = 0,
}: {
  onSuccess?: () => void;
  refreshTrigger?: number;
}) {
  const [date, setDate] = useState(todayISO);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState(todayISO);
  const method: PaymentMethod = "Cash";
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentPublicId, setAttachmentPublicId] = useState<string | null>(null);
  const [attachmentDriveUrl, setAttachmentDriveUrl] = useState<string | null>(null);

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [requestedByOptions, setRequestedByOptions] = useState<string[]>([]);
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([]);
  const [noteOptions, setNoteOptions] = useState<ExpenseNoteDefault[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [nilOpen, setNilOpen] = useState(false);
  const [nilSelected, setNilSelected] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const amountWords = useMemo(() => amountInWords(amount), [amount]);

  const categoryRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const requestedRef = useRef<HTMLInputElement>(null);

  const loadDefaults = useCallback(async () => {
    const res = await apiFetch("/api/defaults");
    const defaults = res.ok
      ? await res.json()
      : {
          expenseCategories: [],
          expenseNames: [],
          approverNames: [],
        };
    setCategoryOptions(defaults.expenseCategories ?? []);
    setRequestedByOptions(defaults.expenseNames ?? []);
    setApprovedByOptions(defaults.approverNames ?? []);
    setNoteOptions(normalizeExpenseNotes(defaults.notes));
  }, []);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults, refreshTrigger]);

  useEffect(() => {
    const onDefaultsUpdated = () => {
      loadDefaults();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") loadDefaults();
    };
    window.addEventListener("ledger-defaults-updated", onDefaultsUpdated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("ledger-defaults-updated", onDefaultsUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadDefaults]);

  function resetForm() {
    setCategory("");
    setAmount("");
    setNote("");
    setNotesOpen(false);
    setRequestedBy("");
    setApprovedBy("");
    setPaymentDueDate(todayISO());
    setDate(todayISO());
    setAttachmentUrl(null);
    setAttachmentPublicId(null);
    setAttachmentDriveUrl(null);
    setNilOpen(false);
    setNilSelected([]);
    setError("");
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  async function saveNilEntries() {
    if (saving) return;
    if (categoryOptions.length === 0) {
      setError("Add categories in Defaults first");
      return;
    }
    const picked = nilSelected.length > 0 ? nilSelected : [];
    if (picked.length === 0) {
      setError("Tick the categories with no work that day");
      setNilOpen(true);
      return;
    }

    setError("");
    setSaving(true);
    try {
      const res = await apiFetch("/api/entries/nil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, categories: picked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save Nil");

      setSaving(false);
      setSaved(true);
      notifyLedgerDataChanged();
      onSuccess?.();
      window.setTimeout(() => {
        setNilOpen(false);
        setNilSelected([]);
        setSaved(false);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Nil");
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (nilSelected.length > 0 && !amount.trim()) {
      await saveNilEntries();
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedRequested = requestedBy.trim();
    const numAmount = Number(amount);

    if (!trimmedCategory) {
      setError("Category is required");
      if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
        categoryRef.current?.focus();
      }
      return;
    }
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      amountRef.current?.focus();
      return;
    }
    if (!trimmedRequested) {
      setError("Requested by is required");
      requestedRef.current?.focus();
      return;
    }
    if (approvedBy.trim() && !paymentDueDate) {
      setError("Select payment date — when will you pay this person?");
      return;
    }

    setError("");
    setSaving(true);

    const payload = {
      type: "expense" as const,
      name: trimmedRequested,
      category: trimmedCategory,
      amount: numAmount,
      method,
      date,
      note: note.trim() || undefined,
      approvedBy: approvedBy.trim() || undefined,
      paymentDueDate: approvedBy.trim() ? paymentDueDate : undefined,
      attachmentUrl: attachmentUrl ?? undefined,
      attachmentPublicId: attachmentPublicId ?? undefined,
      attachmentDriveUrl: attachmentDriveUrl ?? undefined,
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueOfflineEntry(payload);
        setSaving(false);
        setSaved(true);
        notifyLedgerDataChanged();
        onSuccess?.();
        window.setTimeout(() => {
          resetForm();
          setSaved(false);
        }, 1200);
        return;
      }

      const res = await apiFetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 502 && data.entry) {
          setSaving(false);
          setSaved(true);
          notifyLedgerDataChanged();
          onSuccess?.();
          loadDefaults();
          window.setTimeout(() => {
            resetForm();
            setSaved(false);
          }, 1200);
          return;
        }
        throw new Error(data.error || "Failed to save");
      }

      setSaving(false);
      setSaved(true);
      notifyLedgerDataChanged();
      onSuccess?.();
      loadDefaults();

      window.setTimeout(() => {
        resetForm();
        setSaved(false);
      }, 1200);
    } catch (err) {
      if (isNetworkFailure(err)) {
        queueOfflineEntry(payload);
        setSaving(false);
        setSaved(true);
        notifyLedgerDataChanged();
        onSuccess?.();
        window.setTimeout(() => {
          resetForm();
          setSaved(false);
        }, 1200);
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-enter ui-card p-4 sm:p-5">
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <DdMmYyyyDateInput
              embedded
              value={date}
              onChange={setDate}
              required
              ariaLabel="Date"
              wrapperClassName={embeddedFieldClass()}
            />
          </div>

          <div className="min-w-0">
            <SearchableDropdown
              hideLabel
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              placeholder="Category"
              addNewLabel="Add category"
              required
              inputRef={categoryRef}
              onEnter={() => amountRef.current?.focus()}
              inputClassName={fieldClass()}
            />
          </div>
        </div>

        <div>
          <div className="ui-field-divider" role="group" aria-labelledby="amount-field-label">
            <span id="amount-field-label" className="ui-field-divider-label">
              Amount <span className="text-red-500" aria-hidden>*</span>
            </span>
          </div>
          <div className="flex items-stretch gap-2">
            <div className={`min-w-0 flex-1 ${embeddedFieldClass()}`}>
              <span className="shrink-0 text-base font-semibold text-[#0B4A8C]" aria-hidden>
                ₹
              </span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                value={nilSelected.length > 0 && !amount ? "" : amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={nilSelected.length > 0 ? "Nil for selected categories" : "Enter amount"}
                required={nilSelected.length === 0}
                aria-label="Amount"
                aria-describedby={amountWords ? "amount-in-words" : undefined}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold tabular-nums text-[var(--foreground)] outline-none placeholder:text-[var(--text-faint)] [font-size:16px]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                setNilOpen(true);
              }}
              aria-label="Mark categories as Nil for this date"
              aria-expanded={nilOpen}
              className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-[10px] font-extrabold tracking-wide ${
                nilSelected.length > 0
                  ? "border-[#0B4A8C] bg-[#0B4A8C] text-white"
                  : "border-transparent bg-[#f1f5f9] text-[#0B4A8C] hover:bg-[#E8F2FA]"
              }`}
            >
              NIL
            </button>
          </div>
          {amountWords && (
            <p
              id="amount-in-words"
              className="mt-1.5 px-1 text-xs font-medium leading-snug text-[#5A7FA5]"
              role="status"
              aria-live="polite"
            >
              {amountWords}
            </p>
          )}
        </div>

        <div className="relative">
          <textarea
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Expenses notes (optional)"
            aria-label="Expenses notes"
            rows={2}
            className={`${fieldClass()} resize-none ${noteOptions.length > 0 ? "pr-11" : ""}`}
          />
          {noteOptions.length > 0 ? (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-[#0B4A8C] hover:bg-[#E8F2FA]"
              aria-label="Choose a saved note"
              aria-haspopup="dialog"
              aria-expanded={notesOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </button>
          ) : null}
        </div>
        {notesOpen && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Close saved notes"
                  onClick={() => setNotesOpen(false)}
                />
                <div
                  role="dialog"
                  aria-label="Saved expense notes"
                  className="relative z-10 flex max-h-[75dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-2xl"
                >
                  <div className="flex items-center justify-between border-b border-[#E8F0F7] px-4 py-3">
                    <p className="text-sm font-bold text-[#0B4A8C]">Saved notes</p>
                    <button
                      type="button"
                      onClick={() => setNotesOpen(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#0B4A8C]"
                    >
                      Done
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                    {note.trim() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNote("");
                          setNotesOpen(false);
                        }}
                        className="mb-1 w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-500"
                      >
                        Clear note
                      </button>
                    ) : null}
                    {noteOptions.map((item) => {
                      const selected = note.trim().toLowerCase() === item.label.trim().toLowerCase();
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setNote(item.label);
                            if (item.amount && item.amount > 0) {
                              setAmount(formatNoteAmountInput(item.amount));
                            }
                            setNotesOpen(false);
                            amountRef.current?.focus();
                          }}
                          className={`mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium ${
                            selected
                              ? "bg-[#0B4A8C] text-white"
                              : "text-[#0B4A8C] active:bg-[#F4F8FC]"
                          }`}
                        >
                          <span className="min-w-0 truncate">{item.label}</span>
                          {item.amount ? (
                            <span className={`shrink-0 tabular-nums ${selected ? "text-white/80" : "text-[#5A7FA5]"}`}>
                              ₹{item.amount.toLocaleString("en-IN")}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {nilOpen && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Close Nil"
                  onClick={() => setNilOpen(false)}
                />
                <div
                  role="dialog"
                  aria-label="Mark Nil for this date"
                  className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-2xl"
                >
                  <div className="flex items-center justify-between border-b border-[#E8F0F7] px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-[#0B4A8C]">Nil — no work</p>
                      <p className="text-[11px] text-[#5A7FA5]">Tick categories with no work on this date</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNilOpen(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#0B4A8C]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex items-center gap-2 border-b border-[#E8F0F7] px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setNilSelected([...categoryOptions])}
                      className="text-xs font-semibold text-[#0B4A8C]"
                    >
                      Select all
                    </button>
                    <span className="text-[#D6E6F5]">·</span>
                    <button
                      type="button"
                      onClick={() => setNilSelected([])}
                      className="text-xs font-semibold text-[#5A7FA5]"
                    >
                      Clear
                    </button>
                    {nilSelected.length > 0 ? (
                      <span className="ml-auto text-[11px] font-semibold tabular-nums text-[#0B4A8C]">
                        {nilSelected.length} selected
                      </span>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                    {categoryOptions.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-[#5A7FA5]">
                        Add categories in Defaults first.
                      </p>
                    ) : (
                      categoryOptions.map((item) => {
                        const checked = nilSelected.includes(item);
                        const visual = getCategoryVisual(item);
                        return (
                          <label
                            key={item}
                            className={`mb-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 ${
                              checked ? "bg-[#E8F2FA]" : "active:bg-[#F4F8FC]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setNilSelected((prev) =>
                                  prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
                                );
                              }}
                              className="h-5 w-5 rounded border-[#B8CDE3] text-[#0B4A8C] accent-[#0B4A8C]"
                            />
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0B4A8C] ring-1 ring-[#D6E6F5]">
                              <CategoryGlyph icon={visual.icon} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-medium text-[#0B4A8C]">{item}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-[#E8F0F7] p-3">
                    <button
                      type="button"
                      disabled={saving || saved || nilSelected.length === 0}
                      onClick={() => void saveNilEntries()}
                      className="ui-btn-primary w-full disabled:opacity-60"
                    >
                      {saving ? "Saving…" : saved ? "Saved" : `Save Nil (${nilSelected.length})`}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        <div className="min-w-0 space-y-3">
          <SearchableDropdown
            hideLabel
            leadingIcon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            }
            label="Requested by"
            value={requestedBy}
            onChange={setRequestedBy}
            options={requestedByOptions}
            placeholder="Select name"
            addNewLabel="Add name"
            required
            inputRef={requestedRef}
            inputClassName={fieldClass()}
          />
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <SearchableDropdown
              hideLabel
              leadingIcon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              }
              label="Approved by"
              value={approvedBy}
              onChange={(value) => {
                setApprovedBy(value);
                if (!value.trim()) setPaymentDueDate(todayISO());
              }}
              options={approvedByOptions}
              placeholder="Who approved? (optional)"
              addNewLabel="Add approver"
              inputClassName={fieldClass()}
            />
          </div>
          <AttachmentUploader
            variant="icon"
            entryDate={date}
            attachmentUrl={attachmentUrl}
            attachmentPublicId={attachmentPublicId}
            onChange={(url, publicId, driveUrl) => {
              setAttachmentUrl(url);
              setAttachmentPublicId(publicId);
              setAttachmentDriveUrl(driveUrl ?? null);
            }}
            onError={setError}
          />
        </div>

        {approvedBy.trim() ? (
          <div className="min-w-0">
            <div className="ui-field-divider" role="group" aria-labelledby="payment-date-label">
              <span id="payment-date-label" className="ui-field-divider-label">
                Payment date <span className="text-red-500" aria-hidden>*</span>
              </span>
            </div>
            <DdMmYyyyDateInput
              embedded
              value={paymentDueDate}
              onChange={setPaymentDueDate}
              required
              ariaLabel="Payment date — when you will pay this person"
              wrapperClassName={embeddedFieldClass()}
            />
            <p className="mt-1 px-1 text-xs text-[#5A7FA5]">
              When will you pay {requestedBy.trim() || "this person"}? Admin sees this date.
            </p>
          </div>
        ) : null}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || saved}
          aria-live="polite"
          className={`ui-btn-primary disabled:opacity-60 ${
            saved ? "salt-save-btn-success !shadow-none" : ""
          }`}
        >
          {saved ? (
            <>
              <svg
                className="salt-save-check h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              {saving ? "Saving…" : nilSelected.length > 0 && !amount.trim() ? "Save Nil" : "Save Entry"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

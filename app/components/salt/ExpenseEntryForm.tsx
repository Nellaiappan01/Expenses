"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { amountInWords } from "@/lib/amountInWords";
import { isNetworkFailure, queueOfflineEntry } from "@/lib/offlineEntryQueue";
import { notifyLedgerDataChanged } from "@/lib/clientDataCache";
import type { PaymentMethod } from "@/lib/types";
import SearchableDropdown from "../ui/SearchableDropdown";
import AttachmentUploader from "./AttachmentUploader";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fieldClass() {
  return "ui-input";
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

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [requestedByOptions, setRequestedByOptions] = useState<string[]>([]);
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([]);
  const [noteOptions, setNoteOptions] = useState<string[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);

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
    setNoteOptions(defaults.notes ?? []);
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
    setError("");
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

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
            <label className="ui-label">Date</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                aria-label="Date"
                className={`${fieldClass()} pr-8`}
              />
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#7A9BB8]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <SearchableDropdown
              label="Category"
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              placeholder="Select category"
              addNewLabel="Add category"
              required
              inputRef={categoryRef}
              onEnter={() => amountRef.current?.focus()}
              inputClassName={fieldClass()}
              labelClassName="ui-label"
            />
          </div>
        </div>

        <div>
          <label className="ui-label">
            Amount <span className="text-red-500">*</span>
          </label>
          <div
            className={`${fieldClass()} flex items-center gap-2 !px-3 focus-within:border-[rgba(11,74,140,0.22)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(11,74,140,0.1)]`}
          >
            <span className="shrink-0 text-base font-semibold text-[#0B4A8C]" aria-hidden>
              ₹
            </span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Expenses amount"
              required
              aria-label="Expenses amount"
              aria-describedby={amountWords ? "amount-in-words" : undefined}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold tabular-nums text-[var(--foreground)] outline-none placeholder:text-[var(--text-faint)] [font-size:16px]"
            />
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
                      const selected = note.trim().toLowerCase() === item.trim().toLowerCase();
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setNote(item);
                            setNotesOpen(false);
                          }}
                          className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-sm font-medium ${
                            selected
                              ? "bg-[#0B4A8C] text-white"
                              : "text-[#0B4A8C] active:bg-[#F4F8FC]"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        <div className="min-w-0 space-y-3">
          <SearchableDropdown
            label="Requested by"
            value={requestedBy}
            onChange={setRequestedBy}
            options={requestedByOptions}
            placeholder="Select name"
            addNewLabel="Add name"
            required
            inputRef={requestedRef}
            inputClassName={fieldClass()}
            labelClassName="ui-label"
          />
        </div>

        <div className="min-w-0">
          <SearchableDropdown
            label="Approved by"
            value={approvedBy}
            onChange={(value) => {
              setApprovedBy(value);
              if (!value.trim()) setPaymentDueDate(todayISO());
            }}
            options={approvedByOptions}
            placeholder="Who approved on site? (optional now)"
            addNewLabel="Add approver"
            inputClassName={fieldClass()}
            labelClassName="ui-label"
          />
        </div>

        {approvedBy.trim() ? (
          <div className="min-w-0">
            <label className="ui-label">
              Payment date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                required
                aria-label="Payment date — when you will pay this person"
                className={`${fieldClass()} pr-9`}
              />
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A9BB8]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="mt-1 px-1 text-xs text-[#5A7FA5]">
              When will you pay {requestedBy.trim() || "this person"}? Admin sees this date.
            </p>
          </div>
        ) : null}

        <div className="min-w-0">
          <AttachmentUploader
            attachmentUrl={attachmentUrl}
            attachmentPublicId={attachmentPublicId}
            onChange={(url, publicId) => {
              setAttachmentUrl(url);
              setAttachmentPublicId(publicId);
            }}
            onError={setError}
            compact
          />
        </div>

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
              {saving ? "Saving…" : "Save Entry"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

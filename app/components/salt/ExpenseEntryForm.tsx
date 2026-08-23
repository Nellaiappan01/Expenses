"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { amountInWords } from "@/lib/amountInWords";
import type { PaymentMethod } from "@/lib/types";
import SearchableDropdown from "../ui/SearchableDropdown";
import AttachmentUploader from "./AttachmentUploader";
import ExpensePaymentToggle from "./ExpensePaymentToggle";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fieldClass() {
  return "w-full min-h-[48px] rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-3 text-base text-[#0B4A8C] outline-none transition-colors placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white [font-size:16px]";
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
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [tags, setTags] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentPublicId, setAttachmentPublicId] = useState<string | null>(null);

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [requestedByOptions, setRequestedByOptions] = useState<string[]>([]);
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const amountWords = useMemo(() => amountInWords(amount), [amount]);

  const categoryRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const requestedRef = useRef<HTMLInputElement>(null);
  const approvedRef = useRef<HTMLInputElement>(null);

  const loadDefaults = useCallback(async () => {
    const res = await apiFetch("/api/defaults");
    const defaults = res.ok
      ? await res.json()
      : {
          expenseCategories: [],
          expenseNames: [],
          approverNames: [],
          expenseTags: [],
        };
    setCategoryOptions(defaults.expenseCategories ?? []);
    setRequestedByOptions(defaults.expenseNames ?? []);
    setApprovedByOptions(defaults.approverNames ?? []);
    setTagOptions(defaults.expenseTags ?? []);
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
    window.addEventListener("defaults-updated", onDefaultsUpdated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("defaults-updated", onDefaultsUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadDefaults]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  function resetForm(keepMethod: PaymentMethod) {
    setCategory("");
    setAmount("");
    setNote("");
    setRequestedBy("");
    setApprovedBy("");
    setTags("");
    setDate(todayISO());
    setMethod(keepMethod);
    setAttachmentUrl(null);
    setAttachmentPublicId(null);
    setError("");
    requestAnimationFrame(() => categoryRef.current?.focus());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedCategory = category.trim();
    const trimmedRequested = requestedBy.trim();
    const trimmedApproved = approvedBy.trim();
    const numAmount = Number(amount);

    if (!trimmedCategory) {
      setError("Category is required");
      categoryRef.current?.focus();
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
    if (!trimmedApproved) {
      setError("Approved by is required");
      approvedRef.current?.focus();
      return;
    }

    setError("");
    setSaving(true);

    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await apiFetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "expense",
          name: trimmedRequested,
          category: trimmedCategory,
          amount: numAmount,
          method,
          date,
          note: note.trim() || undefined,
          approvedBy: trimmedApproved,
          attachmentUrl: attachmentUrl ?? undefined,
          attachmentPublicId: attachmentPublicId ?? undefined,
          tags: tagList.length ? tagList : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const savedMethod = method;
      resetForm(savedMethod);
      setSuccess(true);
      onSuccess?.();
      loadDefaults();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="form-enter rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm"
    >
      <div className="space-y-3">
        <div className="min-w-0">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
            Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              aria-label="Date"
              className={`${fieldClass()} pr-9`}
            />
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A9BB8]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            labelClassName="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]"
          />
        </div>

        <div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#0B4A8C]">
              ₹
            </span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Expenses amount *"
              required
              aria-label="Expenses amount"
              aria-describedby={amountWords ? "amount-in-words" : undefined}
              className={`${fieldClass()} pl-8 text-base font-semibold tabular-nums`}
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

        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Expenses notes (optional)"
          aria-label="Expenses notes"
          rows={2}
          className={`${fieldClass()} resize-none`}
        />

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
            labelClassName="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]"
          />
          <SearchableDropdown
            label="Approved by"
            value={approvedBy}
            onChange={setApprovedBy}
            options={approvedByOptions}
            placeholder="Select approver"
            addNewLabel="Add approver"
            required
            inputRef={approvedRef}
            inputClassName={fieldClass()}
            labelClassName="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]"
          />
        </div>

        <ExpensePaymentToggle value={method} onChange={setMethod} />

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

        <div className="min-w-0">
          <SearchableDropdown
            hideLabel
            label="Tags"
            value={tags}
            onChange={setTags}
            options={tagOptions}
            placeholder="Tags (optional)"
            addNewLabel="Add tag"
            inputClassName={fieldClass()}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {success && (
          <div
            className="success-enter flex items-center gap-2 rounded-xl bg-[#EEF5FC] px-3 py-2 text-sm font-medium text-[#0B4A8C]"
            role="status"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Entry saved successfully
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B4A8C] py-3.5 text-base font-bold text-white transition-all hover:bg-[#083A6E] active:scale-[0.99] disabled:opacity-60"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {saving ? "Saving…" : "Save Entry"}
        </button>
      </div>
    </form>
  );
}

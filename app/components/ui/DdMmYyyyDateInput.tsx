"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatIsoDateDdMmYyyy,
  maskDdMmYyyyInput,
  parseDdMmYyyyToIsoDate,
  toLocalDateString,
} from "@/lib/dateFormat";

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

type DdMmYyyyDateInputProps = {
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  ariaLabel?: string;
  embedded?: boolean;
  wrapperClassName?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
  id?: string;
};

export default function DdMmYyyyDateInput({
  value,
  onChange,
  required,
  ariaLabel = "Date",
  embedded = false,
  wrapperClassName,
  inputRef,
  onEnter,
  id,
}: DdMmYyyyDateInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const pickerRef = useRef<HTMLInputElement>(null);
  const internalTextRef = useRef<HTMLInputElement>(null);
  const textRef = inputRef ?? internalTextRef;
  const [text, setText] = useState(() => formatIsoDateDdMmYyyy(value));

  useEffect(() => {
    setText(formatIsoDateDdMmYyyy(value));
  }, [value]);

  function commitText(next: string) {
    const iso = parseDdMmYyyyToIsoDate(next);
    if (iso) {
      onChange(iso);
      setText(formatIsoDateDdMmYyyy(iso));
      return;
    }
    setText(formatIsoDateDdMmYyyy(value));
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }
    picker.click();
  }

  const textInput = (
      <input
        ref={textRef}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(maskDdMmYyyyInput(e.target.value))}
        onBlur={() => commitText(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText(text);
            onEnter?.();
          }
        }}
        placeholder="DD-MM-YYYY"
        required={required}
        pattern="\d{2}-\d{2}-\d{4}"
        aria-label={ariaLabel}
        enterKeyHint={onEnter ? "next" : undefined}
        className={
          embedded
            ? "ui-date-embedded"
            : "w-full appearance-none rounded-xl bg-zinc-100 py-3.5 pl-4 pr-11 text-base text-zinc-900 outline-none transition-colors focus:bg-zinc-50 focus:ring-2 focus:ring-emerald-500/30 [font-size:16px]"
        }
      />
  );

  const hiddenPicker = (
    <input
      ref={pickerRef}
      type="date"
      value={value || toLocalDateString()}
      onChange={(e) => {
        onChange(e.target.value);
        setText(formatIsoDateDdMmYyyy(e.target.value));
      }}
      tabIndex={-1}
      aria-hidden
      className="pointer-events-none absolute h-0 w-0 opacity-0"
    />
  );

  if (embedded) {
    return (
      <div className={wrapperClassName}>
        <button
          type="button"
          onClick={openPicker}
          className="shrink-0 text-[#0B4A8C]"
          aria-label={`${ariaLabel} — open calendar`}
        >
          <CalendarIcon />
        </button>
        {textInput}
        {hiddenPicker}
      </div>
    );
  }

  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      {textInput}
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#7A9BB8] hover:bg-[#E8F2FA] hover:text-[#0B4A8C]"
        aria-label={`${ariaLabel} — open calendar`}
      >
        <CalendarIcon />
      </button>
      {hiddenPicker}
    </div>
  );
}

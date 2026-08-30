"use client";

import DdMmYyyyDateInput from "./DdMmYyyyDateInput";

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export default function DateField({ value, onChange, onEnter, inputRef }: DateFieldProps) {
  return (
    <div>
      <label
        htmlFor="entry-date"
        className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
      >
        Date
      </label>
      <DdMmYyyyDateInput
        id="entry-date"
        value={value}
        onChange={onChange}
        onEnter={onEnter}
        inputRef={inputRef}
        required
        ariaLabel="Date"
      />
    </div>
  );
}

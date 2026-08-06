"use client";

function CalendarIcon() {
  return (
    <svg
      className="pointer-events-none h-5 w-5 text-zinc-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

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
      <div className="relative">
        <input
          ref={inputRef}
          id="entry-date"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter?.();
            }
          }}
          enterKeyHint="next"
          required
          className="w-full appearance-none rounded-xl bg-zinc-100 py-3.5 pl-4 pr-11 text-base text-zinc-900 outline-none transition-colors focus:bg-zinc-50 focus:ring-2 focus:ring-emerald-500/30 [font-size:16px] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
        />
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <CalendarIcon />
        </div>
      </div>
    </div>
  );
}

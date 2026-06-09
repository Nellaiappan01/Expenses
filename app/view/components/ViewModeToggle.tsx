"use client";

export type ViewMode = "card" | "table";

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div
      className="relative flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/80"
      role="tablist"
      aria-label="View mode"
    >
      <span
        className={`stock-view-toggle-pill pointer-events-none absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-md ring-1 ring-slate-200/60 ${
          value === "table" ? "left-[calc(50%+2px)]" : "left-1"
        }`}
        aria-hidden
      />
      <button
        type="button"
        role="tab"
        aria-selected={value === "card"}
        onClick={() => onChange("card")}
        className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${
          value === "card" ? "text-stone-800" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <GridIcon />
        <span className="hidden sm:inline">Cards</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "table"}
        onClick={() => onChange("table")}
        className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${
          value === "table" ? "text-stone-800" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <TableIcon />
        <span className="hidden sm:inline">Table</span>
      </button>
    </div>
  );
}

function GridIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M3 14h18M3 6h18M3 18h18"
      />
    </svg>
  );
}

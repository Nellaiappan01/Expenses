export type ExpenseNoteDefault = {
  label: string;
  amount?: number;
};

export function sanitizeNoteAmount(raw: unknown): number | undefined {
  if (raw === "" || raw == null) return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100) / 100;
}

export function formatNoteAmountInput(amount?: number): string {
  if (amount == null || amount <= 0) return "";
  return Number.isInteger(amount) ? String(amount) : String(amount);
}

export function normalizeExpenseNotes(raw: unknown): ExpenseNoteDefault[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const notes: ExpenseNoteDefault[] = [];

  for (const item of raw) {
    let label = "";
    let amount: number | undefined;
    if (typeof item === "string") {
      label = item.trim();
    } else if (item && typeof item === "object") {
      const rec = item as { label?: unknown; note?: unknown; amount?: unknown };
      label = String(rec.label ?? rec.note ?? "").trim();
      amount = sanitizeNoteAmount(rec.amount);
    }
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    notes.push(amount ? { label, amount } : { label });
  }

  return notes;
}

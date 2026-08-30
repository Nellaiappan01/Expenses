export const NIL_DETAIL = "No work this day";

export function isNilEntry(entry: { isNil?: boolean; note?: string; amount?: number }): boolean {
  if (entry.isNil) return true;
  return entry.note?.trim().toLowerCase() === "nil" && Number(entry.amount) === 0;
}

export function nilEntryTitle(entry: { category?: string }): string {
  return entry.category?.trim() || "Nil";
}


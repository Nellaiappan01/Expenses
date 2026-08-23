import type { Entry } from "./types";

export function serializeEntry(entry: Record<string, unknown>) {
  return {
    ...entry,
    _id: entry._id?.toString?.() ?? entry._id,
    createdAt:
      entry.createdAt instanceof Date
        ? entry.createdAt.toISOString()
        : entry.createdAt,
    approvedAt:
      entry.approvedAt instanceof Date
        ? entry.approvedAt.toISOString()
        : entry.approvedAt,
    paymentVerifiedAt:
      entry.paymentVerifiedAt instanceof Date
        ? entry.paymentVerifiedAt.toISOString()
        : entry.paymentVerifiedAt,
  };
}

export function entryToRecord(entry: Entry): Record<string, unknown> {
  return entry as unknown as Record<string, unknown>;
}

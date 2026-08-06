import type { Db } from "mongodb";

let indexesReady: Promise<void> | null = null;

const INDEXES: { collection: string; keys: Record<string, 1 | -1> }[] = [
  { collection: "stock", keys: { businessId: 1, name: 1 } },
  { collection: "stock_in", keys: { businessId: 1, date: -1, createdAt: -1 } },
  { collection: "stock_in", keys: { businessId: 1, stockId: 1 } },
  { collection: "stock_out", keys: { businessId: 1, date: -1, createdAt: -1 } },
  { collection: "stock_out", keys: { businessId: 1, stockId: 1 } },
  { collection: "stock_history", keys: { businessId: 1, stockId: 1, checkDate: -1 } },
  { collection: "stock_history", keys: { businessId: 1, checkDate: -1 } },
  { collection: "entry_audit_logs", keys: { businessId: 1, entryId: 1, editedAt: -1 } },
  { collection: "entries", keys: { businessId: 1, deleted: 1, date: -1 } },
];

export function ensureDbIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      await Promise.all(
        INDEXES.map(({ collection, keys }) =>
          db.collection(collection).createIndex(keys, { background: true })
        )
      );
    })().catch((err) => {
      indexesReady = null;
      console.error("ensureDbIndexes error:", err);
    });
  }
  return indexesReady;
}

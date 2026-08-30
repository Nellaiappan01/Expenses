import { MongoServerError, type Collection, type Db, type WithId } from "mongodb";
import type { SheetsSyncStatus } from "./types";

export const DAILY_PRODUCTION_COLLECTION = "daily_production";
export const DAILY_PRODUCTION_CATEGORY = "Daily Production";
export const DAILY_PRODUCTION_NOTES = "Daily production";

/** Upper bound to catch typos; salt-works daily tonnes stay well below this. */
const MAX_TONNES = 100_000;

export type DailyProductionFields = {
  businessId: string;
  date: string;
  tonnes: number;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  sheetsSyncStatus?: SheetsSyncStatus;
  sheetsSyncError?: string | null;
  sheetsSyncedAt?: Date;
  sheetsSyncLeaseUntil?: Date;
};

export type DailyProductionDoc = WithId<DailyProductionFields>;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseTonnes(raw: unknown): { ok: true; tonnes: number } | { ok: false; error: string } {
  if (raw === "" || raw === null || raw === undefined) {
    return { ok: false, error: "Enter production tonnes" };
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Enter a valid tonnage" };
  }
  if (n < 0) {
    return { ok: false, error: "Tonnage cannot be negative" };
  }
  if (n > MAX_TONNES) {
    return { ok: false, error: "Tonnage is too large" };
  }
  const tonnes = Math.round(n * 100) / 100;
  return { ok: true, tonnes };
}

export function productionCollection(db: Db): Collection<DailyProductionFields> {
  return db.collection<DailyProductionFields>(DAILY_PRODUCTION_COLLECTION);
}

export type SerializedProduction = {
  _id: string;
  date: string;
  tonnes: number;
  category: string | null;
  sheetsSyncStatus: SheetsSyncStatus | null;
  sheetsSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeProduction(doc: DailyProductionDoc): SerializedProduction {
  return {
    _id: doc._id.toString(),
    date: doc.date,
    tonnes: doc.tonnes,
    category: doc.category?.trim() || null,
    sheetsSyncStatus: doc.sheetsSyncStatus ?? null,
    sheetsSyncError: doc.sheetsSyncError ?? null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
  };
}

export async function deleteDailyProduction(
  db: Db,
  businessId: string,
  date: string
): Promise<DailyProductionDoc | null> {
  const col = productionCollection(db);
  return col.findOneAndDelete({ businessId, date });
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

/** One document per businessId + date. Unique index is the race-condition backstop. */
export async function upsertDailyProduction(
  db: Db,
  businessId: string,
  date: string,
  tonnes: number,
  category?: string
): Promise<DailyProductionDoc> {
  const col = productionCollection(db);
  const now = new Date();
  const filter = { businessId, date };
  const trimmedCategory = category?.trim() || "";
  const unset: { sheetsSyncLeaseUntil: ""; category?: "" } = {
    sheetsSyncLeaseUntil: "",
  };
  if (!trimmedCategory) unset.category = "";

  const update = {
    $set: {
      tonnes,
      updatedAt: now,
      sheetsSyncStatus: "pending" as SheetsSyncStatus,
      sheetsSyncError: null,
      ...(trimmedCategory ? { category: trimmedCategory } : {}),
    },
    $unset: unset,
    $setOnInsert: {
      businessId,
      date,
      createdAt: now,
    },
  };

  try {
    const result = await col.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: "after",
    });
    if (result) return result;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }

  const retried = await col.findOneAndUpdate(filter, update, {
    upsert: false,
    returnDocument: "after",
  });
  if (!retried) {
    throw new Error("Could not save daily production");
  }
  return retried;
}

import type { Db } from "mongodb";
import { mergeCategories } from "./entryCategories";

export async function ensureWorkerName(db: Db, businessId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const existing = (doc?.workerNames as string[] | undefined) ?? [];
  if (existing.some((n) => n.trim().toLowerCase() === key)) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId },
      $addToSet: { workerNames: trimmed },
    },
    { upsert: true }
  );
}

export async function ensureWorkerCategory(db: Db, businessId: string, category: string) {
  const trimmed = category.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const existing = mergeCategories(doc?.workerCategories as string[] | undefined);
  if (existing.some((c) => c.toLowerCase() === key)) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId },
      $addToSet: { workerCategories: trimmed },
    },
    { upsert: true }
  );
}

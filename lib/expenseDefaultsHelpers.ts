import type { Db } from "mongodb";
import { mergeExpenseCategories, mergeExpenseTags } from "./entryCategories";

export async function ensureExpenseName(db: Db, businessId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const existing = (doc?.expenseNames as string[] | undefined) ?? [];
  if (existing.some((n) => n.trim().toLowerCase() === key)) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId },
      $addToSet: { expenseNames: trimmed },
    },
    { upsert: true }
  );
}

export async function ensureApproverName(db: Db, businessId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const existing = (doc?.approverNames as string[] | undefined) ?? [];
  if (existing.some((n) => n.trim().toLowerCase() === key)) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId },
      $addToSet: { approverNames: trimmed },
    },
    { upsert: true }
  );
}

export async function ensureExpenseCategory(db: Db, businessId: string, category: string) {
  const trimmed = category.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const existing = mergeExpenseCategories(doc?.expenseCategories as string[] | undefined);
  if (existing.some((c) => c.toLowerCase() === key)) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId },
      $addToSet: { expenseCategories: trimmed },
    },
    { upsert: true }
  );
}

export async function ensureExpenseTag(db: Db, businessId: string, tag: string) {
  const trimmed = tag.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const existing = mergeExpenseTags(doc?.expenseTags as string[] | undefined);
  if (existing.some((t) => t.toLowerCase() === key)) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId },
      $addToSet: { expenseTags: trimmed },
    },
    { upsert: true }
  );
}

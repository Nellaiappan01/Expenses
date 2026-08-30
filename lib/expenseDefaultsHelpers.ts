import type { Db } from "mongodb";
import { mergeExpenseCategories, mergeExpenseTags } from "./entryCategories";
import { sanitizeExpensePerson } from "./expensePeople";
import { normalizeExpenseNotes } from "./expenseNotes";

export async function ensureExpenseName(db: Db, businessId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const existingPeople = (doc?.expensePeople as { nameLower?: string }[] | undefined) ?? [];
  const existingNames = (doc?.expenseNames as string[] | undefined) ?? [];
  if (
    existingPeople.some((p) => p.nameLower === key) ||
    existingNames.some((n) => n.trim().toLowerCase() === key)
  ) {
    return;
  }
  const person = sanitizeExpensePerson({ name: trimmed, preferredMethod: "cash", cashOk: true });
  if (!person) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId },
      $addToSet: { expenseNames: trimmed, expensePeople: person },
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

export async function ensureExpenseNote(db: Db, businessId: string, note: string) {
  const trimmed = note.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const doc = await db.collection("defaults").findOne({ businessId });
  const notes = normalizeExpenseNotes(doc?.notes);
  if (notes.some((n) => n.label.toLowerCase() === key)) return;
  await db.collection("defaults").updateOne(
    { businessId },
    {
      $set: { businessId, notes: [...notes, { label: trimmed }] },
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

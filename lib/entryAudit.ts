import { Db, ObjectId } from "mongodb";
import type { EntryAuditLog } from "./types";

export const NOT_DELETED_MATCH = { deleted: { $ne: true } };

type AuditChange = {
  field: string;
  originalValue: unknown;
  newValue: unknown;
};

export async function recordEntryAuditLogs(
  db: Db,
  params: {
    entryId: string;
    businessId: string;
    action: EntryAuditLog["action"];
    changes: AuditChange[];
    editedBy: string;
    reason: string;
  }
) {
  if (params.changes.length === 0) return;

  const editedAt = new Date();
  const docs: Omit<EntryAuditLog, "_id">[] = params.changes.map((change) => ({
    entryId: params.entryId,
    businessId: params.businessId,
    action: params.action,
    field: change.field,
    originalValue: change.originalValue,
    newValue: change.newValue,
    editedBy: params.editedBy,
    editedAt,
    reason: params.reason,
  }));

  await db.collection("entry_audit_logs").insertMany(docs);
}

export function buildUpdateAuditChanges(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>
): AuditChange[] {
  const changes: AuditChange[] = [];

  for (const [field, newValue] of Object.entries(updates)) {
    const originalValue = existing[field] ?? null;
    const normalizedNew = newValue ?? null;
    if (JSON.stringify(originalValue) !== JSON.stringify(normalizedNew)) {
      changes.push({ field, originalValue, newValue: normalizedNew });
    }
  }

  return changes;
}

export async function entryHasAuditLogs(
  db: Db,
  entryId: string,
  businessId: string
): Promise<boolean> {
  const count = await db.collection("entry_audit_logs").countDocuments({
    entryId,
    businessId,
    action: "update",
  });
  return count > 0;
}

export async function markEntryEdited(
  db: Db,
  entryId: string,
  businessId: string,
  editedBy: string
) {
  await db.collection("entries").updateOne(
    { _id: new ObjectId(entryId), businessId },
    { $set: { isEdited: true, editedAt: new Date(), editedBy } }
  );
}

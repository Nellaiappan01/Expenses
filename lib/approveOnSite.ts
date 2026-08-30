import { ObjectId, type Db } from "mongodb";
import { invalidateBalanceCache } from "@/lib/balance";
import { ensureApproverName } from "@/lib/expenseDefaultsHelpers";
import { NOT_DELETED_MATCH, recordEntryAuditLogs } from "@/lib/entryAudit";
import { scheduleSheetsAdjustment } from "@/lib/googleSheetsSync";
import { canUserModifyEntry, canUserRevertOnSiteApproval } from "@/lib/paymentWorkflow";
import type { Entry } from "@/lib/types";

export type ApproveOnSiteInput = {
  approvedBy: string;
  paymentDueDate: string;
  editedBy: string;
};

export async function approveEntryOnSite(
  db: Db,
  businessId: string,
  entryId: string,
  input: ApproveOnSiteInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const approvedBy = input.approvedBy.trim();
  const paymentDueDate = input.paymentDueDate.trim();
  if (!approvedBy) return { ok: false, error: "Approved by is required" };
  if (!paymentDueDate) return { ok: false, error: "Payment date is required" };

  const existing = await db.collection("entries").findOne({
    _id: new ObjectId(entryId),
    businessId,
    type: "expense",
    ...NOT_DELETED_MATCH,
  });

  if (!existing) return { ok: false, error: "Entry not found" };

  const entryForLock = existing as unknown as Entry;
  if (!canUserModifyEntry(entryForLock)) {
    return { ok: false, error: "This entry can no longer be approved on site." };
  }

  if (existing.approvalStatus !== "pending") {
    return { ok: false, error: "Entry is not awaiting on-site approval" };
  }

  await ensureApproverName(db, businessId, approvedBy);

  const approvedAt = new Date();
  const editedBy = input.editedBy.trim() || approvedBy;

  await recordEntryAuditLogs(db, {
    entryId,
    businessId,
    action: "update",
    changes: [
      {
        field: "approvalStatus",
        originalValue: "pending",
        newValue: "approved",
      },
      {
        field: "approvedBy",
        originalValue: existing.approvedBy ?? null,
        newValue: approvedBy,
      },
      {
        field: "paymentDueDate",
        originalValue: existing.paymentDueDate ?? null,
        newValue: paymentDueDate,
      },
    ],
    editedBy,
    reason: "Approved on site",
  });

  const result = await db.collection("entries").findOneAndUpdate(
    { _id: new ObjectId(entryId), businessId, ...NOT_DELETED_MATCH },
    {
      $set: {
        approvalStatus: "approved",
        approvedBy,
        approvedByLower: approvedBy.toLowerCase(),
        approvedAt,
        paymentDueDate,
        paymentStatus: "pending",
        isEdited: true,
        editedAt: approvedAt,
        editedBy,
      },
    },
    { returnDocument: "after" }
  );

  if (!result) return { ok: false, error: "Update failed" };

  scheduleSheetsAdjustment(
    db,
    businessId,
    entryId,
    "update",
    result as Record<string, unknown>,
    existing as Record<string, unknown>
  );

  return { ok: true };
}

export async function bulkApproveEntriesOnSite(
  db: Db,
  businessId: string,
  entryIds: string[],
  input: ApproveOnSiteInput
): Promise<{ approved: number; failed: number; errors: string[] }> {
  let approved = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entryId of entryIds) {
    const result = await approveEntryOnSite(db, businessId, entryId, input);
    if (result.ok) {
      approved += 1;
    } else {
      failed += 1;
      if (errors.length < 3) errors.push(result.error);
    }
  }

  if (approved > 0) {
    invalidateBalanceCache(businessId);
  }

  return { approved, failed, errors };
}

export async function revertOnSiteApproval(
  db: Db,
  businessId: string,
  entryId: string,
  editedBy: string
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const existing = await db.collection("entries").findOne({
    _id: new ObjectId(entryId),
    businessId,
    type: "expense",
    ...NOT_DELETED_MATCH,
  });

  if (!existing) return { ok: false, error: "Entry not found", status: 404 };

  const entry = existing as unknown as Entry;
  if (entry.paymentStatus === "paid") {
    return { ok: false, error: "Already paid — only admin can change this.", status: 403 };
  }
  if (!canUserRevertOnSiteApproval(entry)) {
    return { ok: false, error: "This entry is not waiting for payment.", status: 400 };
  }

  const revertedAt = new Date();
  const who = editedBy.trim() || "User";

  await recordEntryAuditLogs(db, {
    entryId,
    businessId,
    action: "update",
    changes: [
      {
        field: "approvalStatus",
        originalValue: existing.approvalStatus ?? "approved",
        newValue: "pending",
      },
      {
        field: "approvedBy",
        originalValue: existing.approvedBy ?? null,
        newValue: null,
      },
      {
        field: "paymentDueDate",
        originalValue: existing.paymentDueDate ?? null,
        newValue: null,
      },
    ],
    editedBy: who,
    reason: "User reversed on-site approval to edit or delete",
  });

  const result = await db.collection("entries").findOneAndUpdate(
    { _id: new ObjectId(entryId), businessId, ...NOT_DELETED_MATCH },
    {
      $set: {
        approvalStatus: "pending",
        paymentStatus: "pending",
        isEdited: true,
        editedAt: revertedAt,
        editedBy: who,
      },
      $unset: {
        approvedBy: "",
        approvedByLower: "",
        approvedAt: "",
        paymentDueDate: "",
      },
    },
    { returnDocument: "after" }
  );

  if (!result) return { ok: false, error: "Update failed", status: 500 };

  invalidateBalanceCache(businessId);

  scheduleSheetsAdjustment(
    db,
    businessId,
    entryId,
    "update",
    result as Record<string, unknown>,
    existing as Record<string, unknown>
  );

  return { ok: true };
}

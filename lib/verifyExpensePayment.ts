import { ObjectId, type Db } from "mongodb";
import { invalidateBalanceCache } from "@/lib/balance";
import { NOT_DELETED_MATCH, recordEntryAuditLogs } from "@/lib/entryAudit";
import { markEntrySyncStatus, upsertEntryToSheets } from "@/lib/googleSheetsSync";
import type { PaymentVerifiedMethod } from "@/lib/types";

export async function markExpensePaymentPaid(
  db: Db,
  existing: Record<string, unknown>,
  adminName: string,
  input: {
    paymentMethod: PaymentVerifiedMethod;
    paymentDate: string;
    paymentReference: string;
    paymentPaidTo: string;
    paymentNote: string;
  },
  options?: { deferSheets?: boolean }
): Promise<
  { ok: true; entry: Record<string, unknown> } | { ok: false; error: string }
> {
  const id = String(existing._id);
  const businessId = existing.businessId as string;
  const approvalStatus = existing.approvalStatus as string | undefined;
  const isLegacy = !approvalStatus && !existing.paymentStatus;
  const hasApprover = Boolean(String(existing.approvedBy ?? "").trim());

  if (!isLegacy && approvalStatus !== "approved" && !hasApprover) {
    return { ok: false, error: "Expense must be approved before payment" };
  }
  if (existing.paymentStatus === "paid") {
    return { ok: false, error: "Payment already verified" };
  }

  const { paymentMethod, paymentDate, paymentReference, paymentPaidTo, paymentNote } = input;
  const paymentVerifiedAt = new Date();

  await recordEntryAuditLogs(db, {
    entryId: id,
    businessId,
    action: "payment_verified",
    changes: [
      {
        field: "paymentStatus",
        originalValue: existing.paymentStatus ?? null,
        newValue: "paid",
      },
      {
        field: "paymentVerifiedMethod",
        originalValue: existing.paymentVerifiedMethod ?? null,
        newValue: paymentMethod,
      },
      {
        field: "paymentReference",
        originalValue: existing.paymentReference ?? null,
        newValue: paymentReference || null,
      },
      {
        field: "amount",
        originalValue: existing.amount,
        newValue: existing.amount,
      },
    ],
    editedBy: adminName,
    reason: paymentNote || "Bulk payment verified",
  });

  const updateFields: Record<string, unknown> = {
    paymentStatus: "paid",
    paymentVerifiedMethod: paymentMethod,
    paymentDate,
    paymentReference: paymentReference || undefined,
    paymentPaidTo: paymentPaidTo || undefined,
    paymentVerifiedBy: adminName,
    paymentVerifiedAt,
    paymentNote: paymentNote || undefined,
    isEdited: true,
    editedAt: paymentVerifiedAt,
    editedBy: adminName,
  };

  if (isLegacy) {
    updateFields.approvalStatus = "approved";
  }

  const result = await db.collection("entries").findOneAndUpdate(
    { _id: new ObjectId(id), ...NOT_DELETED_MATCH },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!result) {
    return { ok: false, error: "Payment verification failed" };
  }

  invalidateBalanceCache(businessId);

  const paidDoc = result as Record<string, unknown>;
  const adjustReason = `Paid via ${paymentMethod}${paymentReference ? ` — ${paymentReference}` : ""}`;

  if (options?.deferSheets) {
    return { ok: true, entry: paidDoc };
  }

  await upsertEntryToSheets(db, businessId, id, paidDoc, existing, adjustReason);
  return { ok: true, entry: paidDoc };
}

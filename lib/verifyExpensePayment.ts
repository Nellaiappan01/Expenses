import { ObjectId, type Db } from "mongodb";
import { invalidateBalanceCache } from "@/lib/balance";
import { NOT_DELETED_MATCH, recordEntryAuditLogs } from "@/lib/entryAudit";
import {
  appendEntryToGoogleSheets,
  buildSheetsPayload,
  markEntrySyncStatus,
  syncEntryAdjustment,
  type SheetsWebhookPayload,
} from "@/lib/googleSheetsSync";
import { getSheetsWebhookUrl } from "@/lib/userSettings";
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
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(existing._id);
  const businessId = existing.businessId as string;
  const approvalStatus = existing.approvalStatus as string | undefined;
  const isLegacy = !approvalStatus && !existing.paymentStatus;

  if (!isLegacy && approvalStatus !== "approved") {
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

  const hadSheetSync = existing.sheetsSyncStatus === "synced";
  if (hadSheetSync) {
    await syncEntryAdjustment(
      db,
      businessId,
      id,
      "update",
      result as Record<string, unknown>,
      existing,
      `Paid via ${paymentMethod}${paymentReference ? ` — ${paymentReference}` : ""}`
    );
  } else {
    const payload: SheetsWebhookPayload = {
      action: "append",
      entryId: id,
      ...buildSheetsPayload({
        type: "expense",
        date: result.date as string,
        name: result.name as string,
        category: (result.category as string) ?? "",
        amount: result.amount as number,
        method: (result.method as string) ?? "Cash",
        note: (result.note as string) ?? "",
        bankName: result.bankName as string | undefined,
        approvedBy: (result.approvedBy as string) ?? "",
        approvalStatus: "approved",
        paymentStatus: "paid",
      }),
      adjustReason: `Paid ${paymentDate} — ${paymentMethod}`,
    };
    const webhook = (await getSheetsWebhookUrl(db, businessId)) ?? "";
    const sheetsResult = await appendEntryToGoogleSheets(payload, webhook);
    if (sheetsResult.ok) {
      await markEntrySyncStatus(db, id, businessId, "synced");
    } else {
      await markEntrySyncStatus(db, id, businessId, "failed", sheetsResult.error);
    }
  }

  return { ok: true };
}

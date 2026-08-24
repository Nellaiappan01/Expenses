import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { invalidateBalanceCache } from "@/lib/balance";
import { NOT_DELETED_MATCH, recordEntryAuditLogs } from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { upsertEntryToSheets } from "@/lib/googleSheetsSync";
import { getDb } from "@/lib/mongodb";
import { validatePaymentReference } from "@/lib/paymentReference";
import type { PaymentVerifiedMethod } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const paymentVerifiedMethod = body.paymentMethod as PaymentVerifiedMethod;
    const paymentDate = body.paymentDate?.trim();
    const paymentPaidTo = body.paymentPaidTo?.trim() || "";
    const paymentNote = body.paymentNote?.trim() || "";

    if (
      paymentVerifiedMethod !== "Cash" &&
      paymentVerifiedMethod !== "Bank Transfer" &&
      paymentVerifiedMethod !== "GPay / UPI"
    ) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }
    if (!paymentDate) {
      return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    }

    const referenceCheck = validatePaymentReference(
      paymentVerifiedMethod,
      typeof body.paymentReference === "string" ? body.paymentReference : ""
    );
    if (!referenceCheck.ok) {
      return NextResponse.json({ error: referenceCheck.error }, { status: 400 });
    }
    const paymentReference = referenceCheck.value;
    if (paymentVerifiedMethod === "Cash" && !paymentPaidTo) {
      return NextResponse.json({ error: "Paid to is required for cash" }, { status: 400 });
    }

    const existing = await db.collection("entries").findOne({
      _id: new ObjectId(id),
      type: "expense",
      ...NOT_DELETED_MATCH,
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const businessId = existing.businessId as string;
    const approvalStatus = existing.approvalStatus as string | undefined;
    const isLegacy = !approvalStatus && !existing.paymentStatus;

    if (!isLegacy && approvalStatus !== "approved") {
      return NextResponse.json({ error: "Expense must be approved before payment" }, { status: 400 });
    }
    if (existing.paymentStatus === "paid") {
      return NextResponse.json({ error: "Payment already verified" }, { status: 400 });
    }

    const adminName =
      (auth.user.name as string) || (auth.user.username as string) || auth.adminId;
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
          newValue: paymentVerifiedMethod,
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
      reason: paymentNote || "Payment verified",
    });

    const updateFields: Record<string, unknown> = {
      paymentStatus: "paid",
      paymentVerifiedMethod,
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
      return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
    }

    invalidateBalanceCache(businessId);

    const sheetsResult = await upsertEntryToSheets(
      db,
      businessId,
      id,
      result as Record<string, unknown>,
      existing as Record<string, unknown>,
      `Paid via ${paymentVerifiedMethod}${paymentReference ? ` — ${paymentReference}` : ""}`
    );

    return NextResponse.json({
      ...serializeEntry(result),
      sheetsSyncStatus: sheetsResult.status,
      sheetsSyncError: sheetsResult.error ?? null,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
  }
}

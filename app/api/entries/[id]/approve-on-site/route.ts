import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { invalidateBalanceCache } from "@/lib/balance";
import { ensureApproverName } from "@/lib/expenseDefaultsHelpers";
import { NOT_DELETED_MATCH, recordEntryAuditLogs } from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { scheduleSheetsAdjustment } from "@/lib/googleSheetsSync";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { canUserModifyEntry } from "@/lib/paymentWorkflow";
import type { Entry } from "@/lib/types";

/** User sets Approved by on site — no full adjust form, no admin. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const body = await request.json();
    const approvedBy = body.approvedBy?.trim();
    const paymentDueDate = body.paymentDueDate?.trim();
    if (!approvedBy) {
      return NextResponse.json({ error: "Approved by is required" }, { status: 400 });
    }
    if (!paymentDueDate) {
      return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    }

    const userId = await getUserId(request);
    const db = await getDb();

    const existing = await db.collection("entries").findOne({
      _id: new ObjectId(id),
      businessId: userId,
      type: "expense",
      ...NOT_DELETED_MATCH,
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const entryForLock = existing as unknown as Entry;
    if (!canUserModifyEntry(entryForLock)) {
      return NextResponse.json(
        { error: "This entry can no longer be approved on site." },
        { status: 403 }
      );
    }

    if (existing.approvalStatus !== "pending") {
      return NextResponse.json({ error: "Entry is not awaiting on-site approval" }, { status: 400 });
    }

    await ensureApproverName(db, userId, approvedBy);

    const approvedAt = new Date();
    const editedBy = body.editedBy?.trim() || approvedBy;

    await recordEntryAuditLogs(db, {
      entryId: id,
      businessId: userId,
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
      { _id: new ObjectId(id), businessId: userId, ...NOT_DELETED_MATCH },
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

    if (!result) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    invalidateBalanceCache(userId);

    scheduleSheetsAdjustment(
      db,
      userId,
      id,
      "update",
      result as Record<string, unknown>,
      existing as Record<string, unknown>
    );

    return NextResponse.json({
      ...serializeEntry(result as Record<string, unknown>),
      sheetsSyncStatus: "pending",
      sheetsSyncError: null,
    });
  } catch (error) {
    console.error("Approve on site error:", error);
    return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
  }
}

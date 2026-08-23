import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { invalidateBalanceCache } from "@/lib/balance";
import { ensureApproverName } from "@/lib/expenseDefaultsHelpers";
import { NOT_DELETED_MATCH, recordEntryAuditLogs } from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { syncEntryAdjustment } from "@/lib/googleSheetsSync";
import { getDb } from "@/lib/mongodb";

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
    const approvedBy = body.approvedBy?.trim();
    if (!approvedBy) {
      return NextResponse.json({ error: "Approved by is required" }, { status: 400 });
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
    const currentApproval = existing.approvalStatus as string | undefined;
    if (currentApproval === "approved" && existing.paymentStatus !== "pending") {
      return NextResponse.json({ error: "Already approved" }, { status: 400 });
    }
    if (currentApproval === "rejected") {
      return NextResponse.json({ error: "Cannot approve a rejected request" }, { status: 400 });
    }

    await ensureApproverName(db, businessId, approvedBy);

    const approvedAt = new Date();
    const adminName =
      (auth.user.name as string) || (auth.user.username as string) || auth.adminId;

    await recordEntryAuditLogs(db, {
      entryId: id,
      businessId,
      action: "approve",
      changes: [
        {
          field: "approvalStatus",
          originalValue: existing.approvalStatus ?? null,
          newValue: "approved",
        },
        {
          field: "approvedBy",
          originalValue: existing.approvedBy ?? null,
          newValue: approvedBy,
        },
      ],
      editedBy: adminName,
      reason: body.reason?.trim() || "Expense approved",
    });

    const result = await db.collection("entries").findOneAndUpdate(
      { _id: new ObjectId(id), ...NOT_DELETED_MATCH },
      {
        $set: {
          approvalStatus: "approved",
          approvedBy,
          approvedByLower: approvedBy.toLowerCase(),
          approvedAt,
          paymentStatus: "pending",
          isEdited: true,
          editedAt: approvedAt,
          editedBy: adminName,
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Approve failed" }, { status: 500 });
    }

    invalidateBalanceCache(businessId);

    let sheetsSyncStatus = result.sheetsSyncStatus as string | undefined;
    let sheetsSyncError: string | null = null;
    const sheetsResult = await syncEntryAdjustment(
      db,
      businessId,
      id,
      "update",
      result as Record<string, unknown>,
      existing as Record<string, unknown>
    );
    sheetsSyncStatus = sheetsResult.status;
    sheetsSyncError = sheetsResult.error ?? null;

    return NextResponse.json({
      ...serializeEntry(result),
      sheetsSyncStatus,
      sheetsSyncError,
    });
  } catch (error) {
    console.error("Approve entry error:", error);
    return NextResponse.json({ error: "Failed to approve entry" }, { status: 500 });
  }
}

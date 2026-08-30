import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { approveEntryOnSite } from "@/lib/approveOnSite";
import { serializeEntry } from "@/lib/entrySerialize";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { canUserModifyEntry } from "@/lib/paymentWorkflow";
import type { Entry } from "@/lib/types";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { invalidateBalanceCache } from "@/lib/balance";

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

    const result = await approveEntryOnSite(db, userId, id, {
      approvedBy,
      paymentDueDate,
      editedBy: body.editedBy?.trim() || approvedBy,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    invalidateBalanceCache(userId);

    const updated = await db.collection("entries").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    return NextResponse.json({
      ...serializeEntry(updated as Record<string, unknown>),
      sheetsSyncStatus: "pending",
      sheetsSyncError: null,
    });
  } catch (error) {
    console.error("Approve on site error:", error);
    return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
  }
}

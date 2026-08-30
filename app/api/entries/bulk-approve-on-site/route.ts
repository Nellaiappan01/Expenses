import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { bulkApproveEntriesOnSite } from "@/lib/approveOnSite";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

const MAX_BULK = 50;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy.trim() : "";
    const paymentDueDate = typeof body.paymentDueDate === "string" ? body.paymentDueDate.trim() : "";
    const editedBy = typeof body.editedBy === "string" ? body.editedBy.trim() : "";
    const entryIds = Array.isArray(body.entryIds)
      ? body.entryIds.filter((id: unknown) => typeof id === "string" && ObjectId.isValid(id))
      : [];

    if (entryIds.length < 2) {
      return NextResponse.json(
        { error: "Select at least 2 entries for bulk approval" },
        { status: 400 }
      );
    }
    if (entryIds.length > MAX_BULK) {
      return NextResponse.json(
        { error: `Bulk approval is limited to ${MAX_BULK} entries` },
        { status: 400 }
      );
    }
    if (!approvedBy) {
      return NextResponse.json({ error: "Approved by is required" }, { status: 400 });
    }
    if (!paymentDueDate) {
      return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    }

    const userId = await getUserId(request);
    const db = await getDb();

    const result = await bulkApproveEntriesOnSite(db, userId, entryIds, {
      approvedBy,
      paymentDueDate,
      editedBy: editedBy || approvedBy,
    });

    if (result.approved === 0) {
      return NextResponse.json(
        { error: result.errors[0] || "Could not approve entries" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      approved: result.approved,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Bulk approve on site error:", error);
    return NextResponse.json({ error: "Failed to bulk approve" }, { status: 500 });
  }
}

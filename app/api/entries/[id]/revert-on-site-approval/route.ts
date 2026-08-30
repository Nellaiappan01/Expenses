import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { revertOnSiteApproval } from "@/lib/approveOnSite";
import { serializeEntry } from "@/lib/entrySerialize";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

/** User undoes on-site approval so they can edit or delete before admin pays. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const editedBy = typeof body.editedBy === "string" ? body.editedBy.trim() : "";

    const userId = await getUserId(request);
    const db = await getDb();
    const result = await revertOnSiteApproval(db, userId, id, editedBy);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    const updated = await db.collection("entries").findOne({
      _id: new ObjectId(id),
      businessId: userId,
      ...NOT_DELETED_MATCH,
    });

    return NextResponse.json(serializeEntry(updated as Record<string, unknown>));
  } catch (error) {
    console.error("Revert on-site approval error:", error);
    return NextResponse.json({ error: "Failed to reverse approval" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(
    {
      error:
        "Direct entry edits are not allowed. Use POST /api/entries/{id}/adjust with a reason to record audit history.",
      adjustUrl: `/api/entries/${id}/adjust`,
    },
    { status: 403 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(
    {
      error:
        "Direct entry deletes are not allowed. Use DELETE /api/entries/{id}/adjust with a reason to record audit history.",
      adjustUrl: `/api/entries/${id}/adjust`,
    },
    { status: 403 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const userId = await getUserId(request);
    const db = await getDb();
    const entry = await db.collection("entries").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...entry,
      _id: entry._id?.toString(),
      createdAt: entry.createdAt?.toISOString?.(),
      deletedAt: entry.deletedAt instanceof Date ? entry.deletedAt.toISOString() : entry.deletedAt,
      editedAt: entry.editedAt instanceof Date ? entry.editedAt.toISOString() : entry.editedAt,
    });
  } catch (error) {
    console.error("Error fetching entry:", error);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

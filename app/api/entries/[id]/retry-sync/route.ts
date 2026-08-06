import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { syncEntryById } from "@/lib/googleSheetsSync";

export async function POST(
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

    const exists = await db.collection("entries").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });
    if (!exists) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const result = await syncEntryById(db, userId, id);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        entryId: id,
        sheetsSyncStatus: "synced",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        entryId: id,
        sheetsSyncStatus: "failed",
        error: result.error ?? "Google Sheets sync failed",
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("[Entries] retry-sync error:", error);
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { getDb } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const ids = (request.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => ObjectId.isValid(id));

    if (ids.length === 0) {
      return NextResponse.json({ total: 0, synced: 0, pending: 0, failed: 0, done: 0 });
    }

    const entries = await db
      .collection("entries")
      .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
      .project({ sheetsSyncStatus: 1 })
      .toArray();

    let synced = 0;
    let pending = 0;
    let failed = 0;
    for (const entry of entries) {
      const status = entry.sheetsSyncStatus as string | undefined;
      if (status === "synced") synced += 1;
      else if (status === "failed") failed += 1;
      else pending += 1;
    }

    return NextResponse.json({
      total: entries.length,
      synced,
      pending,
      failed,
      done: synced,
    });
  } catch (error) {
    console.error("Sync progress error:", error);
    return NextResponse.json({ total: 0, synced: 0, pending: 0, failed: 0, done: 0 });
  }
}

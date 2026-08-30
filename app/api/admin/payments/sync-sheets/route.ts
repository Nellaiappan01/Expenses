import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { upsertEntryToSheets } from "@/lib/googleSheetsSync";
import { getDb } from "@/lib/mongodb";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string" && ObjectId.isValid(id))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "No entries to sync" }, { status: 400 });
    }

    const entries = await db
      .collection("entries")
      .find({ _id: { $in: ids.map((id: string) => new ObjectId(id)) }, ...NOT_DELETED_MATCH })
      .toArray();

    if (entries.length === 0) {
      return NextResponse.json({ error: "Entries not found" }, { status: 404 });
    }

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      if (entry.sheetsSyncStatus === "synced") {
        synced += 1;
        continue;
      }

      const businessId = String(entry.businessId ?? "");
      if (!businessId) {
        failed += 1;
        errors.push(`${entry._id}: missing site account`);
        continue;
      }

      const entryId = String(entry._id);
      const adjustReason =
        typeof entry.paymentNote === "string" && entry.paymentNote.trim()
          ? entry.paymentNote.trim()
          : `Paid via ${String(entry.paymentVerifiedMethod || "admin")}`;

      const result = await upsertEntryToSheets(
        db,
        businessId,
        entryId,
        entry as Record<string, unknown>,
        entry as Record<string, unknown>,
        adjustReason
      );

      if (result.ok) {
        synced += 1;
      } else {
        failed += 1;
        if (result.error) errors.push(result.error);
      }
    }

    return NextResponse.json({
      ok: failed === 0,
      synced,
      failed,
      queued: synced + failed,
      errors: errors.slice(0, 3),
    });
  } catch (error) {
    console.error("Sync sheets queue error:", error);
    return NextResponse.json({ error: "Failed to sync sheet rows" }, { status: 500 });
  }
}

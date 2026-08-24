import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { scheduleSheetsUpserts } from "@/lib/googleSheetsSync";
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

    const byBusiness = new Map<string, typeof entries>();
    for (const entry of entries) {
      const businessId = String(entry.businessId ?? "");
      if (!businessId) continue;
      const list = byBusiness.get(businessId) ?? [];
      list.push(entry);
      byBusiness.set(businessId, list);
    }

    let queued = 0;
    for (const [businessId, list] of byBusiness) {
      scheduleSheetsUpserts(
        db,
        businessId,
        list.map((entry) => ({
          entryId: String(entry._id),
          entryDoc: entry as Record<string, unknown>,
          originalEntry: entry as Record<string, unknown>,
          adjustReason: typeof entry.paymentNote === "string" ? entry.paymentNote : "",
        }))
      );
      queued += list.length;
    }

    return NextResponse.json({ ok: true, queued });
  } catch (error) {
    console.error("Sync sheets queue error:", error);
    return NextResponse.json({ error: "Failed to queue sheet sync" }, { status: 500 });
  }
}

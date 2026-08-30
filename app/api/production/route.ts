import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import {
  deleteDailyProduction,
  isIsoDate,
  parseTonnes,
  productionCollection,
  serializeProduction,
  upsertDailyProduction,
} from "@/lib/dailyProduction";
import { deleteDailyProductionFromSheets, syncDailyProductionToSheets } from "@/lib/dailyProductionSync";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date")?.trim() ?? "";
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    const db = await getDb();
    const col = productionCollection(db);

    if (date) {
      if (!isIsoDate(date)) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const doc = await col.findOne({ businessId: userId, date });
      return NextResponse.json({ production: doc ? serializeProduction(doc) : null });
    }

    if (from || to) {
      if (from && !isIsoDate(from)) {
        return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
      }
      if (to && !isIsoDate(to)) {
        return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
      }
      const dateMatch: Record<string, string> = {};
      if (from) dateMatch.$gte = from;
      if (to) dateMatch.$lte = to;
      const docs = await col.find({ businessId: userId, date: dateMatch }).toArray();
      const byDate: Record<string, ReturnType<typeof serializeProduction>> = {};
      for (const doc of docs) {
        byDate[doc.date] = serializeProduction(doc);
      }
      return NextResponse.json({ productions: byDate });
    }

    return NextResponse.json({ error: "date or from/to is required" }, { status: 400 });
  } catch (error) {
    console.error("GET /api/production", error);
    return NextResponse.json({ error: "Failed to load production" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = (await request.json()) as { date?: unknown; tonnes?: unknown; category?: unknown };
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";

    if (!isIsoDate(date)) {
      return NextResponse.json({ error: "Select a valid date" }, { status: 400 });
    }

    const parsed = parseTonnes(body.tonnes);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const db = await getDb();
    const doc = await upsertDailyProduction(db, userId, date, parsed.tonnes, category);
    await syncDailyProductionToSheets(db, userId, doc._id.toString());
    const latest = await productionCollection(db).findOne({ _id: doc._id, businessId: userId });

    return NextResponse.json({ production: serializeProduction(latest ?? doc) });
  } catch (error) {
    console.error("PUT /api/production", error);
    return NextResponse.json({ error: "Failed to save production" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date")?.trim() ?? "";
    if (!isIsoDate(date)) {
      return NextResponse.json({ error: "Select a valid date" }, { status: 400 });
    }

    const db = await getDb();
    const doc = await deleteDailyProduction(db, userId, date);
    if (!doc) {
      return NextResponse.json({ error: "No production for this date" }, { status: 404 });
    }

    const sheetsResult = await deleteDailyProductionFromSheets(
      db,
      userId,
      doc._id.toString(),
      doc.date
    );
    return NextResponse.json({
      ok: true,
      date,
      sheetsSyncStatus: sheetsResult.ok ? "synced" : "failed",
      sheetsSyncError: sheetsResult.ok ? null : sheetsResult.error ?? "Google Sheet row was not removed",
    });
  } catch (error) {
    console.error("DELETE /api/production", error);
    return NextResponse.json({ error: "Failed to delete production" }, { status: 500 });
  }
}

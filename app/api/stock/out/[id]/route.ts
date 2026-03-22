import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

async function getRecord(db: Awaited<ReturnType<typeof import("@/lib/mongodb").getDb>>, id: string, userId: string) {
  const record = await db.collection("stock_out").findOne({
    _id: new ObjectId(id),
    businessId: userId,
  });
  return record;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(request);
    const db = await getDb();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const record = await getRecord(db, id, userId);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const body = await request.json();
    const { count, note, date } = body;

    const stockItem = await db.collection("stock").findOne({
      _id: new ObjectId(record.stockId),
      businessId: userId,
    });
    if (!stockItem) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const oldCount = record.count ?? 0;
    const newCount = typeof count === "number" && count >= 0 ? count : oldCount;
    const countDiff = newCount - oldCount;

    const currentStockCount = stockItem.count ?? 0;
    if (countDiff > 0 && currentStockCount < countDiff) {
      return NextResponse.json(
        { error: `Only ${currentStockCount} available. Cannot increase out by ${countDiff}.` },
        { status: 400 }
      );
    }

    const now = new Date();
    const newStockCount = currentStockCount - countDiff;

    await db.collection("stock_out").updateOne(
      { _id: new ObjectId(id), businessId: userId },
      {
        $set: {
          count: newCount,
          note: note !== undefined ? (String(note).trim() || undefined) : record.note,
          date: date || record.date,
        },
      }
    );

    await db.collection("stock").updateOne(
      { _id: stockItem._id, businessId: userId },
      { $set: { count: newStockCount, updatedAt: now } }
    );

    await db.collection("stock_history").insertOne({
      stockId: record.stockId,
      businessId: userId,
      previousCount: currentStockCount,
      newCount: newStockCount,
      difference: -countDiff,
      checkDate: now,
      note: "Stock out edit",
      createdAt: now,
    });

    const updated = await db.collection("stock_out").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    return NextResponse.json({
      ...updated,
      _id: updated?._id?.toString(),
      name: stockItem.name,
    });
  } catch (error) {
    console.error("Stock out PATCH error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(request);
    const db = await getDb();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const record = await getRecord(db, id, userId);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const stockItem = await db.collection("stock").findOne({
      _id: new ObjectId(record.stockId),
      businessId: userId,
    });
    if (!stockItem) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const outCount = record.count ?? 0;
    const currentStockCount = stockItem.count ?? 0;
    const now = new Date();

    await db.collection("stock_out").deleteOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    await db.collection("stock").updateOne(
      { _id: stockItem._id, businessId: userId },
      { $set: { count: currentStockCount + outCount, updatedAt: now } }
    );

    await db.collection("stock_history").insertOne({
      stockId: record.stockId,
      businessId: userId,
      previousCount: currentStockCount,
      newCount: currentStockCount + outCount,
      difference: outCount,
      checkDate: now,
      note: "Stock out deleted - restored",
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stock out DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

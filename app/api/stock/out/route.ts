import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const items = await db
      .collection("stock")
      .find({ businessId: userId })
      .toArray();
    const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

    const records = await db
      .collection("stock_out")
      .find({ businessId: userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    const serialized = records.map((r) => {
      const item = itemMap.get(r.stockId);
      return {
        ...r,
        _id: r._id?.toString(),
        name: item?.name ?? r.stockId,
        createdAt: r.createdAt?.toISOString?.(),
      };
    });

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Stock out GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const { stockId, count, note, date } = body;

    if (!stockId?.trim()) {
      return NextResponse.json({ error: "Stock item required" }, { status: 400 });
    }
    const outCount = Number(count);
    if (isNaN(outCount) || outCount <= 0) {
      return NextResponse.json({ error: "Valid count required" }, { status: 400 });
    }

    const db = await getDb();
    const stockItem = await db.collection("stock").findOne({
      _id: new ObjectId(stockId),
      businessId: userId,
    });
    if (!stockItem) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const currentCount = stockItem.count ?? 0;
    if (currentCount < outCount) {
      return NextResponse.json(
        { error: `Only ${currentCount} available. Cannot take out ${outCount}.` },
        { status: 400 }
      );
    }

    const dateStr = date || new Date().toISOString().split("T")[0];
    const now = new Date();

    const record = {
      stockId: stockItem._id.toString(),
      businessId: userId,
      count: outCount,
      note: (note || "").trim() || undefined,
      date: dateStr,
      createdAt: now,
    };

    const result = await db.collection("stock_out").insertOne(record);
    const newStockCount = currentCount - outCount;

    await db.collection("stock").updateOne(
      { _id: stockItem._id, businessId: userId },
      { $set: { count: newStockCount, updatedAt: now } }
    );

    await db.collection("stock_history").insertOne({
      stockId: stockItem._id.toString(),
      businessId: userId,
      previousCount: currentCount,
      newCount: newStockCount,
      difference: -outCount,
      checkDate: now,
      note: (note || "").trim() || undefined,
      createdAt: now,
    });

    return NextResponse.json({
      ...record,
      _id: result.insertedId.toString(),
      name: stockItem.name,
    });
  } catch (error) {
    console.error("Stock out POST error:", error);
    return NextResponse.json({ error: "Failed to record stock out" }, { status: 500 });
  }
}

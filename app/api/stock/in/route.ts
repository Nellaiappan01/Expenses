import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { toLocalDateString } from "@/lib/dateFormat";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const items = await db.collection("stock").find({ businessId: userId }).toArray();
    const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

    const records = await db
      .collection("stock_in")
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
    console.error("Stock in GET error:", error);
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
    const inCount = Number(count);
    if (isNaN(inCount) || inCount <= 0) {
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
    const dateStr = date || toLocalDateString();
    const now = new Date();

    const record = {
      stockId: stockItem._id.toString(),
      businessId: userId,
      count: inCount,
      note: (note || "").trim() || undefined,
      date: dateStr,
      createdAt: now,
    };

    const newStockCount = currentCount + inCount;

    const [insertResult] = await Promise.all([
      db.collection("stock_in").insertOne(record),
      db.collection("stock").updateOne(
        { _id: stockItem._id, businessId: userId },
        { $set: { count: newStockCount, updatedAt: now } }
      ),
      db.collection("stock_history").insertOne({
        stockId: stockItem._id.toString(),
        businessId: userId,
        previousCount: currentCount,
        newCount: newStockCount,
        difference: inCount,
        checkDate: now,
        note: (note || "").trim() || "Stock in",
        createdAt: now,
      }),
    ]);

    return NextResponse.json({
      ...record,
      _id: insertResult.insertedId.toString(),
      name: stockItem.name,
      newStockCount,
    });
  } catch (error) {
    console.error("Stock in POST error:", error);
    return NextResponse.json({ error: "Failed to record stock in" }, { status: 500 });
  }
}

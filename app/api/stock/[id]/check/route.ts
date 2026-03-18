import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function POST(
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

    const body = await request.json();
    const newCount = Number(body.count);
    if (isNaN(newCount) || newCount < 0) {
      return NextResponse.json({ error: "Valid count required" }, { status: 400 });
    }

    const existing = await db.collection("stock").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const previousCount = existing.count ?? 0;
    const difference = newCount - previousCount;
    const now = new Date();

    await db.collection("stock_history").insertOne({
      stockId: id,
      businessId: userId,
      previousCount,
      newCount,
      difference,
      checkDate: now,
      createdAt: now,
    });

    const result = await db.collection("stock").findOneAndUpdate(
      { _id: new ObjectId(id), businessId: userId },
      { $set: { count: newCount, lastCheckAt: now, updatedAt: now } },
      { returnDocument: "after" }
    );

    return NextResponse.json({
      ...result,
      _id: result?._id?.toString(),
      previousCount,
      newCount,
      difference,
      lastCheckAt: result?.lastCheckAt?.toISOString?.(),
    });
  } catch (error) {
    console.error("Stock check error:", error);
    return NextResponse.json({ error: "Failed to update count" }, { status: 500 });
  }
}

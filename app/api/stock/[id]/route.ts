import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

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

    const body = await request.json();
    const { name, count, valuePerUnit } = body;

    const existing = await db.collection("stock").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) {
      update.name = String(name).trim();
      update.nameLower = String(name).trim().toLowerCase();
    }
    if (count !== undefined) update.count = Number(count);
    if (valuePerUnit !== undefined) update.valuePerUnit = Number(valuePerUnit);

    const result = await db.collection("stock").findOneAndUpdate(
      { _id: new ObjectId(id), businessId: userId },
      { $set: update },
      { returnDocument: "after" }
    );

    return NextResponse.json({
      ...result,
      _id: result?._id?.toString(),
      createdAt: result?.createdAt?.toISOString?.(),
      updatedAt: result?.updatedAt?.toISOString?.(),
      lastCheckAt: result?.lastCheckAt?.toISOString?.(),
    });
  } catch (error) {
    console.error("Stock PATCH error:", error);
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

    const result = await db.collection("stock").deleteOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    await db.collection("stock_history").deleteMany({ stockId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Stock DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

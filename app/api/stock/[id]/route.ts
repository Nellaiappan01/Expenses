import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { deleteStockPhoto } from "@/lib/stockPhoto";
import { deleteStockImage } from "@/lib/cloudinary";
import { serializeStockItem } from "@/lib/stockSerialize";

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
    const {
      name,
      count,
      valuePerUnit,
      sku,
      brand,
      size,
      category,
      location,
      notes,
      minStock,
    } = body;

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
    if (sku !== undefined) update.sku = String(sku).trim();
    if (brand !== undefined) update.brand = String(brand).trim();
    if (size !== undefined) update.size = String(size).trim();
    if (category !== undefined) update.category = String(category).trim();
    if (location !== undefined) update.location = String(location).trim();
    if (notes !== undefined) update.notes = String(notes).trim();
    if (minStock !== undefined) update.minStock = Number(minStock) || 0;

    const result = await db.collection("stock").findOneAndUpdate(
      { _id: new ObjectId(id), businessId: userId },
      { $set: update },
      { returnDocument: "after" }
    );

    return NextResponse.json(
      serializeStockItem({ ...result, _id: result?._id?.toString() })
    );
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

    const existing = await db.collection("stock").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    await db.collection("stock").deleteOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    await db.collection("stock_history").deleteMany({ stockId: id });
    if (existing.photoPublicId) {
      await deleteStockImage(existing.photoPublicId as string);
    }
    await deleteStockPhoto(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Stock DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

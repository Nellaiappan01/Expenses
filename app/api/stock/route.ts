import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { serializeStockItem } from "@/lib/stockSerialize";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const items = await db
      .collection("stock")
      .find({ businessId: userId })
      .sort({ name: 1 })
      .toArray();

    const serialized = items.map((i) =>
      serializeStockItem({ ...i, _id: i._id?.toString() })
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Stock GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const {
      name,
      count = 0,
      valuePerUnit = 0,
      sku = "",
      brand = "",
      size = "",
      category = "",
      location = "",
      notes = "",
      minStock = 0,
    } = body;

    const nameTrim = (name || "").trim();
    if (!nameTrim) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db.collection("stock").findOne({
      businessId: userId,
      nameLower: nameTrim.toLowerCase(),
    });
    if (existing) {
      return NextResponse.json({ error: "Stock item already exists" }, { status: 400 });
    }

    const initialCount = Number(count) || 0;
    const doc = {
      businessId: userId,
      name: nameTrim,
      nameLower: nameTrim.toLowerCase(),
      count: initialCount,
      openingCount: initialCount,
      valuePerUnit: Number(valuePerUnit) || 0,
      sku: String(sku || "").trim(),
      brand: String(brand || "").trim(),
      size: String(size || "").trim(),
      category: String(category || "").trim(),
      location: String(location || "").trim(),
      notes: String(notes || "").trim(),
      minStock: Number(minStock) || 0,
      hasPhoto: false,
      lastCheckAt: null as Date | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("stock").insertOne(doc);

    return NextResponse.json({
      _id: result.insertedId.toString(),
      name: doc.name,
      count: doc.count,
      valuePerUnit: doc.valuePerUnit,
      lastCheckAt: null,
      sku: doc.sku,
      brand: doc.brand,
      size: doc.size,
      category: doc.category,
      location: doc.location,
      notes: doc.notes,
      minStock: doc.minStock,
      hasPhoto: false,
    });
  } catch (error) {
    console.error("Stock POST error:", error);
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}

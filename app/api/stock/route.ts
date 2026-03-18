import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const items = await db
      .collection("stock")
      .find({ businessId: userId })
      .sort({ name: 1 })
      .toArray();

    const serialized = items.map((i) => ({
      ...i,
      _id: i._id?.toString(),
      createdAt: i.createdAt?.toISOString?.(),
      updatedAt: i.updatedAt?.toISOString?.(),
      lastCheckAt: i.lastCheckAt?.toISOString?.(),
    }));

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
    const { name, count = 0, valuePerUnit = 0 } = body;

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

    const doc = {
      businessId: userId,
      name: nameTrim,
      nameLower: nameTrim.toLowerCase(),
      count: Number(count) || 0,
      valuePerUnit: Number(valuePerUnit) || 0,
      lastCheckAt: null as Date | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("stock").insertOne(doc);

    return NextResponse.json({
      ...doc,
      _id: result.insertedId.toString(),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Stock POST error:", error);
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}

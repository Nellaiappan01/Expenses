import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { isValidMobile, sanitizeMobileInput } from "@/lib/phone";
import { serializeStockRequest } from "@/lib/stockRequestSerialize";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "pending";
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

    const db = await getDb();
    const items = await db.collection("stock").find({ businessId: userId }).toArray();
    const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

    const filter: { businessId: string; status?: string } = { businessId: userId };
    if (statusParam !== "all") {
      filter.status = statusParam;
    }

    const records = await db
      .collection("stock_requests")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      records.map((r) => serializeStockRequest(r, itemMap.get(r.stockId as string)))
    );
  } catch (error) {
    console.error("Stock requests GET:", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const { stockId, qty, customerName, customerPhone, note } = body;

    if (!stockId?.trim()) {
      return NextResponse.json({ error: "Product required" }, { status: 400 });
    }
    const q = Number(qty);
    if (isNaN(q) || q <= 0) {
      return NextResponse.json({ error: "Valid quantity required" }, { status: 400 });
    }
    const name = (customerName || "").trim();
    const phone = sanitizeMobileInput((customerPhone || "").trim());
    if (!name) {
      return NextResponse.json({ error: "Customer name required" }, { status: 400 });
    }
    if (!isValidMobile(phone)) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
    }

    const db = await getDb();
    const stockItem = await db.collection("stock").findOne({
      _id: new ObjectId(stockId),
      businessId: userId,
    });
    if (!stockItem) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const now = new Date();
    const doc = {
      stockId: stockItem._id.toString(),
      businessId: userId,
      qty: q,
      customerName: name,
      customerPhone: phone,
      note: (note || "").trim() || undefined,
      status: "pending" as const,
      createdAt: now,
    };

    const result = await db.collection("stock_requests").insertOne(doc);
    return NextResponse.json(
      serializeStockRequest({ ...doc, _id: result.insertedId }, stockItem),
      { status: 201 }
    );
  } catch (error) {
    console.error("Stock requests POST:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}

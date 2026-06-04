import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { stockThumbUrl } from "@/lib/cloudinaryUrls";
import { isValidMobile, sanitizeMobileInput } from "@/lib/phone";

function serializeRequest(
  r: Record<string, unknown>,
  item?: Record<string, unknown> | null
) {
  const photoUrl = (item?.photoUrl as string) || "";
  return {
    _id: (r._id as { toString: () => string }).toString(),
    stockId: r.stockId as string,
    businessId: r.businessId as string,
    qty: r.qty ?? 1,
    customerName: r.customerName ?? "Customer",
    customerPhone: r.customerPhone as string | undefined,
    note: r.note as string | undefined,
    resolutionNote: r.resolutionNote as string | undefined,
    status: r.status as string,
    createdAt: (r.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    resolvedAt: (r.resolvedAt as Date)?.toISOString?.(),
    name: (item?.name as string) ?? r.stockId,
    godownCount: item?.count ?? 0,
    hasPhoto: !!(item?.hasPhoto || photoUrl),
    photoUrl: photoUrl || undefined,
    photoThumbUrl: photoUrl ? stockThumbUrl(photoUrl) : undefined,
    brand: item?.brand as string | undefined,
    size: item?.size as string | undefined,
  };
}

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
      records.map((r) => serializeRequest(r, itemMap.get(r.stockId as string)))
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
      serializeRequest({ ...doc, _id: result.insertedId }, stockItem),
      { status: 201 }
    );
  } catch (error) {
    console.error("Stock requests POST:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}

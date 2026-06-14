import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { isValidMobile, sanitizeMobileInput } from "@/lib/phone";
import { serializeStockRequest } from "@/lib/stockRequestSerialize";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(request);
    const body = await request.json();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const db = await getDb();
    const req = await db.collection("stock_requests").findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });
    if (!req) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const isPending = req.status === "pending";

    if (body.customerName !== undefined) {
      const name = String(body.customerName || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Customer name required" }, { status: 400 });
      }
      updates.customerName = name;
    }

    if (body.customerPhone !== undefined) {
      const phone = sanitizeMobileInput(String(body.customerPhone || "").trim());
      if (!isValidMobile(phone)) {
        return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
      }
      updates.customerPhone = phone;
    }

    if (body.note !== undefined) {
      updates.note = String(body.note || "").trim() || undefined;
    }

    if (body.resolutionNote !== undefined && !isPending) {
      updates.resolutionNote = String(body.resolutionNote || "").trim() || undefined;
    }

    if (isPending) {
      if (body.stockId !== undefined) {
        const stockId = String(body.stockId || "").trim();
        if (!stockId || !ObjectId.isValid(stockId)) {
          return NextResponse.json({ error: "Valid product required" }, { status: 400 });
        }
        const stockItem = await db.collection("stock").findOne({
          _id: new ObjectId(stockId),
          businessId: userId,
        });
        if (!stockItem) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }
        updates.stockId = stockItem._id.toString();
      }

      if (body.qty !== undefined) {
        const q = Number(body.qty);
        if (isNaN(q) || q <= 0) {
          return NextResponse.json({ error: "Valid quantity required" }, { status: 400 });
        }
        updates.qty = q;
      }
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await db.collection("stock_requests").updateOne({ _id: new ObjectId(id) }, { $set: updates });

    const updated = await db.collection("stock_requests").findOne({ _id: new ObjectId(id) });
    const stockItem = await db.collection("stock").findOne({
      _id: new ObjectId(updated!.stockId as string),
      businessId: userId,
    });

    return NextResponse.json(serializeStockRequest(updated!, stockItem));
  } catch (error) {
    console.error("Stock request PUT:", error);
    return NextResponse.json({ error: "Failed to update claim" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(request);

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("stock_requests").deleteOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stock request DELETE:", error);
    return NextResponse.json({ error: "Failed to delete claim" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(request);
    const body = await request.json();
    const action = body.action as "approve" | "reject";
    const resolutionNote = ((body.resolutionNote as string) || "").trim() || undefined;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    const db = await getDb();
    const req = await db.collection("stock_requests").findOne({
      _id: new ObjectId(id),
      businessId: userId,
      status: "pending",
    });
    if (!req) {
      return NextResponse.json({ error: "Request not found or already handled" }, { status: 404 });
    }

    const now = new Date();
    const status = action === "approve" ? "approved" : "rejected";

    await db.collection("stock_requests").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, resolvedAt: now, resolutionNote } }
    );

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Stock request PATCH:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}

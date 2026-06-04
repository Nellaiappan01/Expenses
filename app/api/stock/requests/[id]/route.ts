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

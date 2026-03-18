import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function GET(
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

    const history = await db
      .collection("stock_history")
      .find({ stockId: id, businessId: userId })
      .sort({ checkDate: -1 })
      .limit(50)
      .toArray();

    const serialized = history.map((h) => ({
      ...h,
      _id: h._id?.toString(),
      previousCount: h.previousCount,
      newCount: h.newCount,
      difference: h.difference,
      checkDate: h.checkDate?.toISOString?.(),
      createdAt: h.createdAt?.toISOString?.(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Stock history error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

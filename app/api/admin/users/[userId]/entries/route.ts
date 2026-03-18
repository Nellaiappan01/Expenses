import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import type { Entry } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const adminId = await getUserId(request);
    const db = await getDb();

    const admin = await db.collection("users").findOne({ userId: adminId });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

    const match: Record<string, unknown> = { businessId: targetUserId };
    if (from || to) {
      match.date = {};
      if (from) (match.date as Record<string, string>).$gte = from;
      if (to) (match.date as Record<string, string>).$lte = to;
    }

    const entries = await db
      .collection<Entry>("entries")
      .find(match)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    const serialized = entries.map((e) => ({
      ...e,
      _id: e._id?.toString(),
      createdAt: e.createdAt?.toISOString?.(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Admin get user entries error:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

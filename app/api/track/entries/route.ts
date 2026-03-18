import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import type { Entry } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const name = searchParams.get("name")?.trim();
    const method = searchParams.get("method");
    const search = searchParams.get("search")?.trim();
    const type = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

    const db = await getDb();
    const collection = db.collection<Entry>("entries");

    const userId = getUserId(request);
    const match: Record<string, unknown> = { businessId: userId };

    if (from || to) {
      match.date = {};
      if (from) (match.date as Record<string, string>).$gte = from;
      if (to) (match.date as Record<string, string>).$lte = to;
    }
    if (name) match.nameLower = name.toLowerCase();
    if (method && (method === "Cash" || method === "GPay")) match.method = method;
    if (type && ["income", "expense", "worker_payment", "adjustment"].includes(type)) match.type = type;
    if (search) {
      const searchLower = search.toLowerCase();
      match.$or = [
        { nameLower: { $regex: searchLower, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
      ];
    }

    const [entries, total] = await Promise.all([
      collection
        .find(match)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(match),
    ]);

    const serialized = entries.map((e) => ({
      ...e,
      _id: e._id?.toString(),
      createdAt: e.createdAt?.toISOString(),
    }));

    return NextResponse.json({
      entries: serialized,
      total,
      page,
      hasMore: page * limit < total,
    });
  } catch (error) {
    console.error("Error fetching track entries:", error);
    return NextResponse.json({
      entries: [],
      total: 0,
      page: 1,
      hasMore: false,
    });
  }
}

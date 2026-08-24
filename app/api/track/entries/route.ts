import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { healNamedApprovals } from "@/lib/healNamedApprovals";
import { buildTrackEntryMatch, trackFiltersFromSearchParams } from "@/lib/trackEntryFilters";
import type { Entry } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

    const db = await getDb();
    const collection = db.collection<Entry>("entries");
    const userId = await getUserId(request);
    await healNamedApprovals(db, userId);
    const match = buildTrackEntryMatch(userId, trackFiltersFromSearchParams(searchParams));

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
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
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

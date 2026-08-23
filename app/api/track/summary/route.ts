import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { buildTrackEntryMatch, trackFiltersFromSearchParams } from "@/lib/trackEntryFilters";
import { buildTrackSummaryStats } from "@/lib/trackWhatsAppSummary";
import type { Entry } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = await getUserId(request);
    const db = await getDb();
    const match = buildTrackEntryMatch(userId, trackFiltersFromSearchParams(searchParams));

    const entries = await db
      .collection<Entry>("entries")
      .find(match)
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json(buildTrackSummaryStats(entries));
  } catch (error) {
    console.error("Error fetching track summary:", error);
    return NextResponse.json(
      {
        totalAmount: 0,
        totalEntries: 0,
        categoryBreakdown: [],
        payments: [],
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { healNamedApprovals } from "@/lib/healNamedApprovals";
import { buildTrackEntryMatch, trackFiltersFromSearchParams } from "@/lib/trackEntryFilters";
import { buildTrackSummaryStats, buildWorkflowTotals } from "@/lib/trackWhatsAppSummary";
import type { Entry } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = await getUserId(request);
    const db = await getDb();
    await healNamedApprovals(db, userId);
    const filters = trackFiltersFromSearchParams(searchParams);
    const listMatch = buildTrackEntryMatch(userId, filters);
    const overviewMatch = buildTrackEntryMatch(userId, {
      ...filters,
      workflowStatus: null,
      sheetsSync: null,
    });

    const [entries, overviewEntries] = await Promise.all([
      db
        .collection<Entry>("entries")
        .find(listMatch)
        .sort({ date: -1, createdAt: -1 })
        .toArray(),
      db
        .collection<Entry>("entries")
        .find(overviewMatch)
        .project({
          type: 1,
          amount: 1,
          approvalStatus: 1,
          paymentStatus: 1,
          approvedBy: 1,
        })
        .toArray(),
    ]);

    const stats = buildTrackSummaryStats(entries);
    stats.workflowTotals = buildWorkflowTotals(overviewEntries as Entry[]);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching track summary:", error);
    return NextResponse.json(
      {
        totalAmount: 0,
        totalEntries: 0,
        categoryBreakdown: [],
        requestedByBreakdown: [],
        payments: [],
        workflowTotals: {
          pendingApproval: { amount: 0, count: 0 },
          paymentPending: { amount: 0, count: 0 },
          paidVerified: { amount: 0, count: 0 },
        },
      },
      { status: 500 }
    );
  }
}

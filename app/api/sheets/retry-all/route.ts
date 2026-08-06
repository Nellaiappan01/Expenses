import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { getSheetsSyncCounts, retryAllFailedSyncs } from "@/lib/googleSheetsSync";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();

    const results = await retryAllFailedSyncs(db, userId);
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const counts = await getSheetsSyncCounts(db, userId);

    return NextResponse.json({
      ok: failed === 0,
      succeeded,
      failed,
      results,
      counts,
    });
  } catch (error) {
    console.error("[Sheets] retry-all error:", error);
    return NextResponse.json({ error: "Retry all failed" }, { status: 500 });
  }
}

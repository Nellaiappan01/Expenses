import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { getSheetsSyncCounts, getSheetsSyncFailureSample } from "@/lib/googleSheetsSync";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const counts = await getSheetsSyncCounts(db, userId);
    const failures = await getSheetsSyncFailureSample(db, userId);
    return NextResponse.json({ ...counts, failures });
  } catch (error) {
    console.error("[Sheets] status error:", error);
    return NextResponse.json({ pending: 0, failed: 0, total: 0 });
  }
}

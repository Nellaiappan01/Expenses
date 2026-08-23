import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { ENTRY_TOTALS_GROUP_FIELDS } from "@/lib/entryAmount";
import { buildTotalsBreakdown, EMPTY_TOTALS } from "@/lib/totals";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const db = await getDb();
    const userId = await getUserId(request);
    const match: Record<string, unknown> = { businessId: userId, deleted: { $ne: true } };

    if (from || to) {
      match.date = {};
      if (from) (match.date as Record<string, string>).$gte = from;
      if (to) (match.date as Record<string, string>).$lte = to;
    }

    const [row] = await db
      .collection("entries")
      .aggregate<{
        walletIn: number;
        walletOut: number;
        expense: number;
        workerPayment: number;
        adjustment: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: null,
            ...ENTRY_TOTALS_GROUP_FIELDS,
          },
        },
      ])
      .toArray();

    if (!row) {
      return NextResponse.json(EMPTY_TOTALS);
    }

    return NextResponse.json(buildTotalsBreakdown(row));
  } catch (error) {
    console.error("Error fetching totals:", error);
    return NextResponse.json(EMPTY_TOTALS);
  }
}

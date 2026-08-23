import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { ENTRY_TOTALS_GROUP_FIELDS } from "@/lib/entryAmount";
import { buildTotalsBreakdown } from "@/lib/totals";

export interface DashboardSummary {
  rotationCash: number;
  expense: number;
  workerPayment: number;
  adjustment: number;
  net: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const userId = await getUserId(request);
    const match: Record<string, unknown> = { businessId: userId, deleted: { $ne: true } };
    if (from || to) {
      match.date = {};
      if (from) (match.date as Record<string, string>).$gte = from;
      if (to) (match.date as Record<string, string>).$lte = to;
    }

    const db = await getDb();
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
      return NextResponse.json({
        rotationCash: 0,
        expense: 0,
        workerPayment: 0,
        adjustment: 0,
        net: 0,
      } satisfies DashboardSummary);
    }

    const totals = buildTotalsBreakdown(row);
    const summary: DashboardSummary = {
      rotationCash: totals.walletIn - totals.walletOut,
      expense: totals.expense,
      workerPayment: totals.workerPayment,
      adjustment: totals.adjustment,
      net: totals.net,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return NextResponse.json({
      rotationCash: 0,
      expense: 0,
      workerPayment: 0,
      adjustment: 0,
      net: 0,
    });
  }
}

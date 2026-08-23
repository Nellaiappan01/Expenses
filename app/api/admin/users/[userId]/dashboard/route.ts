import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { computeNetBalance } from "@/lib/balance";
import { ENTRY_TOTALS_GROUP_FIELDS } from "@/lib/entryAmount";
import { buildTotalsBreakdown, EMPTY_TOTALS } from "@/lib/totals";

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

    const match: Record<string, unknown> = {
      businessId: targetUserId,
      deleted: { $ne: true },
    };
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

    const period = row ? buildTotalsBreakdown(row) : { ...EMPTY_TOTALS };
    const closingBalance = await computeNetBalance(db, targetUserId);

    return NextResponse.json({
      ...period,
      closingBalance,
    });
  } catch (error) {
    console.error("Admin get user dashboard error:", error);
    return NextResponse.json(
      {
        ...EMPTY_TOTALS,
        closingBalance: 0,
      },
      { status: 500 }
    );
  }
}

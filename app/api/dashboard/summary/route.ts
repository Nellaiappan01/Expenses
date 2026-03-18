import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

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
    const match: Record<string, unknown> = { businessId: userId };
    if (from || to) {
      match.date = {};
      if (from) (match.date as Record<string, string>).$gte = from;
      if (to) (match.date as Record<string, string>).$lte = to;
    }

    const db = await getDb();
    const result = await db
      .collection("entries")
      .aggregate<{ _id: string; total: number }>([
        { $match: match },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ])
      .toArray();

    const summary: DashboardSummary = {
      rotationCash: 0,
      expense: 0,
      workerPayment: 0,
      adjustment: 0,
      net: 0,
    };

    for (const row of result) {
      if (row._id === "rotation_cash") summary.rotationCash = row.total;
      else if (row._id === "expense") summary.expense = row.total;
      else if (row._id === "worker_payment") summary.workerPayment = row.total;
      else if (row._id === "adjustment") summary.adjustment = row.total;
    }
    summary.net = summary.rotationCash - summary.expense - summary.workerPayment + summary.adjustment;

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

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export interface DashboardSummary {
  income: number;
  expense: number;
  workerPayment: number;
  adjustment: number;
  net: number;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const db = await getDb();
    const result = await db
      .collection("entries")
      .aggregate<{ _id: string; total: number }>([
        { $match: { businessId: userId } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ])
      .toArray();

    const summary: DashboardSummary = {
      income: 0,
      expense: 0,
      workerPayment: 0,
      adjustment: 0,
      net: 0,
    };

    for (const row of result) {
      if (row._id === "income") summary.income = row.total;
      else if (row._id === "expense") summary.expense = row.total;
      else if (row._id === "worker_payment") summary.workerPayment = row.total;
      else if (row._id === "adjustment") summary.adjustment = row.total;
    }
    summary.net = summary.income + summary.expense + summary.workerPayment + summary.adjustment;

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return NextResponse.json({
      income: 0,
      expense: 0,
      workerPayment: 0,
      adjustment: 0,
      net: 0,
    });
  }
}

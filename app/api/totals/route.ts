import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const db = await getDb();
    const userId = getUserId(request);
    const match: Record<string, unknown> = { businessId: userId };

    if (from || to) {
      match.date = {};
      if (from) (match.date as Record<string, string>).$gte = from;
      if (to) (match.date as Record<string, string>).$lte = to;
    }

    const result = await db
      .collection("entries")
      .aggregate<{ _id: string; total: number }>([
        { $match: match },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ])
      .toArray();

    const totals = {
      rotationCash: 0,
      expense: 0,
      workerPayment: 0,
      adjustment: 0,
      received: 0,
      paid: 0,
      net: 0,
    };

    for (const row of result) {
      if (row._id === "rotation_cash") totals.rotationCash = row.total;
      else if (row._id === "expense") totals.expense = row.total;
      else if (row._id === "worker_payment") totals.workerPayment = row.total;
      else if (row._id === "adjustment") totals.adjustment = row.total;
    }

    totals.received = totals.rotationCash;
    totals.paid = totals.expense + totals.workerPayment;
    totals.net = totals.rotationCash + totals.expense + totals.workerPayment + totals.adjustment;

    return NextResponse.json(totals);
  } catch (error) {
    console.error("Error fetching totals:", error);
    return NextResponse.json({
      rotationCash: 0,
      expense: 0,
      workerPayment: 0,
      adjustment: 0,
      received: 0,
      paid: 0,
      net: 0,
    });
  }
}

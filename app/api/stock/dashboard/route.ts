import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = [7, 15, 30].includes(Number(daysParam))
      ? Number(daysParam)
      : 7;

    const db = await getDb();

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    const items = await db
      .collection("stock")
      .find({ businessId: userId })
      .toArray();
    const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

    const history = await db
      .collection("stock_history")
      .find({
        businessId: userId,
        checkDate: { $gte: fromDate },
      })
      .sort({ checkDate: 1 })
      .toArray();

    type DayData = {
      date: string;
      inCount: number;
      outCount: number;
      inValue: number;
      outValue: number;
      netCount: number;
      netValue: number;
      entries: { name: string; diff: number; value: number }[];
    };
    const dayMap = new Map<string, DayData>();

    for (const h of history) {
      const item = itemMap.get(h.stockId);
      const name = item?.name ?? h.stockId;
      const valuePerUnit = item?.valuePerUnit ?? 0;
      const diff = h.difference ?? 0;
      const valueDiff = diff * valuePerUnit;

      const d = h.checkDate ? new Date(h.checkDate) : new Date();
      const dateKey = d.toISOString().split("T")[0];

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          inCount: 0,
          outCount: 0,
          inValue: 0,
          outValue: 0,
          netCount: 0,
          netValue: 0,
          entries: [],
        });
      }
      const day = dayMap.get(dateKey)!;
      day.entries.push({ name, diff, value: valueDiff });

      if (diff >= 0) {
        day.inCount += diff;
        day.inValue += valueDiff;
      } else {
        day.outCount += Math.abs(diff);
        day.outValue += Math.abs(valueDiff);
      }
      day.netCount += diff;
      day.netValue += valueDiff;
    }

    const daysArray = Array.from(dayMap.values()).sort(
      (a, b) => b.date.localeCompare(a.date)
    );

    return NextResponse.json({ days: daysArray });
  } catch (error) {
    console.error("Stock dashboard error:", error);
    return NextResponse.json({ days: [] }, { status: 500 });
  }
}

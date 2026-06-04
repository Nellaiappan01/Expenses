import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { computeItemTally } from "@/lib/stockTally";
import { addLocalDays, toLocalDateString } from "@/lib/dateFormat";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const daysParam = Number(searchParams.get("days"));
    const days = [1, 7, 15, 30].includes(daysParam) ? daysParam : 7;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateString(todayStart);

    const span = days <= 1 ? 0 : days - 1;
    const fromStr = toLocalDateString(addLocalDays(todayStart, -span));

    const db = await getDb();
    const items = await db.collection("stock").find({ businessId: userId }).toArray();

    const [allIn, allOut, periodInRecs, periodOutRecs] = await Promise.all([
      db.collection("stock_in").find({ businessId: userId }).toArray(),
      db.collection("stock_out").find({ businessId: userId }).toArray(),
      db.collection("stock_in").find({ businessId: userId, date: { $gte: fromStr } }).toArray(),
      db.collection("stock_out").find({ businessId: userId, date: { $gte: fromStr } }).toArray(),
    ]);

    const totalInByStock = new Map<string, number>();
    const totalOutByStock = new Map<string, number>();
    const todayInByStock = new Map<string, number>();
    const todayOutByStock = new Map<string, number>();

    let todayIn = 0;
    let todayOut = 0;
    let overallIn = 0;
    let overallOut = 0;

    for (const r of allIn) {
      const c = r.count ?? 0;
      const sid = r.stockId as string;
      overallIn += c;
      totalInByStock.set(sid, (totalInByStock.get(sid) ?? 0) + c);
      if (r.date === todayStr) {
        todayIn += c;
        todayInByStock.set(sid, (todayInByStock.get(sid) ?? 0) + c);
      }
    }
    for (const r of allOut) {
      const c = r.count ?? 0;
      const sid = r.stockId as string;
      overallOut += c;
      totalOutByStock.set(sid, (totalOutByStock.get(sid) ?? 0) + c);
      if (r.date === todayStr) {
        todayOut += c;
        todayOutByStock.set(sid, (todayOutByStock.get(sid) ?? 0) + c);
      }
    }

    let periodIn = 0;
    let periodOut = 0;
    for (const r of periodInRecs) periodIn += r.count ?? 0;
    for (const r of periodOutRecs) periodOut += r.count ?? 0;

    let godownUnits = 0;
    let godownValue = 0;
    let correctionCount = 0;
    let checkedToday = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;
    let checkedInStock = 0;
    let checkedNil = 0;

    const itemRows = [];
    for (const item of items) {
      const id = item._id.toString();
      const godown = item.count ?? 0;
      const valuePerUnit = item.valuePerUnit ?? 0;
      const totalIn = totalInByStock.get(id) ?? 0;
      const totalOut = totalOutByStock.get(id) ?? 0;

      let openingCount = item.openingCount as number | undefined;
      if (openingCount === undefined || openingCount === null) {
        openingCount = godown;
        await db.collection("stock").updateOne(
          { _id: item._id, businessId: userId },
          { $set: { openingCount: godown, updatedAt: new Date() } }
        );
      }

      const tally = computeItemTally({
        godown,
        openingCount,
        totalIn,
        totalOut,
      });

      const lastCheckAt = item.lastCheckAt ? new Date(item.lastCheckAt) : null;
      const checkedTodayItem = !!(lastCheckAt && lastCheckAt >= todayStart);
      if (checkedTodayItem) checkedToday++;

      if (godown > 0) {
        inStockCount++;
        if (checkedTodayItem) checkedInStock++;
      } else {
        outOfStockCount++;
        if (checkedTodayItem) checkedNil++;
      }

      godownUnits += godown;
      godownValue += godown * valuePerUnit;

      if (tally.needsCorrection) correctionCount++;

      itemRows.push({
        _id: id,
        name: item.name,
        godown,
        opening: tally.opening,
        totalIn,
        totalOut,
        todayIn: todayInByStock.get(id) ?? 0,
        todayOut: todayOutByStock.get(id) ?? 0,
        expected: tally.expected,
        variance: tally.variance,
        missingInQty: tally.missingInQty,
        hint: tally.hint,
        value: godown * valuePerUnit,
        lastCheckAt: lastCheckAt?.toISOString() ?? null,
        checkedToday: checkedTodayItem,
        status: tally.status,
      });
    }

    const statusOrder: Record<string, number> = {
      correction_in: 0,
      correction_out: 1,
      correction_count: 2,
      ok: 3,
    };
    itemRows.sort(
      (a, b) =>
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
        a.name.localeCompare(b.name)
    );

    const tallyOk = correctionCount === 0;

    return NextResponse.json({
      days,
      todayDate: todayStr,
      tallyOk,
      eveningComplete: items.length > 0 && checkedToday >= items.length,
      checkedToday,
      today: { date: todayStr, in: todayIn, out: todayOut, net: todayIn - todayOut },
      overall: { in: overallIn, out: overallOut, net: overallIn - overallOut },
      summary: {
        godownUnits,
        godownValue,
        periodIn,
        periodOut,
        netMovement: periodIn - periodOut,
        itemCount: items.length,
        inStockCount,
        outOfStockCount,
        checkedInStock,
        checkedNil,
        nilPending: outOfStockCount - checkedNil,
        correctionCount,
      },
      items: itemRows,
    });
  } catch (error) {
    console.error("Stock tally error:", error);
    return NextResponse.json({ error: "Failed to load tally" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { addLocalDays, toLocalDateString } from "@/lib/dateFormat";

type DayData = {
  date: string;
  inCount: number;
  outCount: number;
  checkCount: number;
  inValue: number;
  outValue: number;
  netCount: number;
  netValue: number;
  entries: {
    name: string;
    diff: number;
    value: number;
    type: "in" | "out" | "check";
    at: string | null;
    date: string;
  }[];
};

function ensureDay(dayMap: Map<string, DayData>, dateKey: string) {
  if (!dayMap.has(dateKey)) {
    dayMap.set(dateKey, {
      date: dateKey,
      inCount: 0,
      outCount: 0,
      checkCount: 0,
      inValue: 0,
      outValue: 0,
      netCount: 0,
      netValue: 0,
      entries: [],
    });
  }
  return dayMap.get(dateKey)!;
}

function parseIsoDate(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const fromParam = parseIsoDate(searchParams.get("from"));
    const toParam = parseIsoDate(searchParams.get("to"));
    const daysParam = searchParams.get("days");
    const presetDays = [7, 15, 30].includes(Number(daysParam)) ? Number(daysParam) : 7;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateString(today);

    let fromStr: string;
    let toStr: string;
    let rangeMode: "preset" | "custom" = "preset";
    let rangeDays = presetDays;

    if (fromParam && toParam) {
      rangeMode = "custom";
      fromStr = fromParam <= toParam ? fromParam : toParam;
      toStr = fromParam <= toParam ? toParam : fromParam;
      const fromMs = new Date(`${fromStr}T00:00:00`).getTime();
      const toMs = new Date(`${toStr}T00:00:00`).getTime();
      rangeDays = Math.max(1, Math.round((toMs - fromMs) / 86400000) + 1);
    } else {
      const fromDate = addLocalDays(today, -(presetDays - 1));
      fromStr = toLocalDateString(fromDate);
      toStr = todayStr;
    }

    const fromDateStart = new Date(`${fromStr}T00:00:00`);
    const toDateEnd = new Date(`${toStr}T23:59:59.999`);

    const db = await getDb();

    const items = await db.collection("stock").find({ businessId: userId }).toArray();
    const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

    const dateFilter = { $gte: fromStr, $lte: toStr };

    const [inRecords, outRecords, history] = await Promise.all([
      db.collection("stock_in").find({ businessId: userId, date: dateFilter }).toArray(),
      db.collection("stock_out").find({ businessId: userId, date: dateFilter }).toArray(),
      db
        .collection("stock_history")
        .find({
          businessId: userId,
          checkDate: { $gte: fromDateStart, $lte: toDateEnd },
        })
        .sort({ checkDate: 1 })
        .toArray(),
    ]);

    const dayMap = new Map<string, DayData>();
    let totalIn = 0;
    let totalOut = 0;

    for (const r of inRecords) {
      const item = itemMap.get(r.stockId);
      const name = item?.name ?? r.stockId;
      const vpu = item?.valuePerUnit ?? 0;
      const c = r.count ?? 0;
      const dateKey = r.date || fromStr;
      const day = ensureDay(dayMap, dateKey);
      day.inCount += c;
      day.inValue += c * vpu;
      day.netCount += c;
      day.netValue += c * vpu;
      const at = r.createdAt ? new Date(r.createdAt).toISOString() : null;
      day.entries.push({ name, diff: c, value: c * vpu, type: "in", at, date: dateKey });
      totalIn += c;
    }

    for (const r of outRecords) {
      const item = itemMap.get(r.stockId);
      const name = item?.name ?? r.stockId;
      const vpu = item?.valuePerUnit ?? 0;
      const c = r.count ?? 0;
      const dateKey = r.date || fromStr;
      const day = ensureDay(dayMap, dateKey);
      day.outCount += c;
      day.outValue += c * vpu;
      day.netCount -= c;
      day.netValue -= c * vpu;
      const at = r.createdAt ? new Date(r.createdAt).toISOString() : null;
      day.entries.push({ name, diff: -c, value: -(c * vpu), type: "out", at, date: dateKey });
      totalOut += c;
    }

    const checkNotes = new Set(["Stock in", "Stock out", "Stock in edit", "Stock out edit", "Stock in deleted - reversed", "Stock out deleted - restored"]);
    for (const h of history) {
      const note = (h.note as string) || "";
      if (checkNotes.has(note) || note.startsWith("Stock in") || note.startsWith("Stock out")) {
        continue;
      }
      const item = itemMap.get(h.stockId);
      const name = item?.name ?? h.stockId;
      const vpu = item?.valuePerUnit ?? 0;
      const diff = h.difference ?? 0;
      const valueDiff = diff * vpu;
      const d = h.checkDate ? new Date(h.checkDate) : new Date();
      const dateKey = toLocalDateString(d);
      const day = ensureDay(dayMap, dateKey);
      day.checkCount += Math.abs(diff);
      const at = h.checkDate ? new Date(h.checkDate).toISOString() : null;
      day.entries.push({ name, diff, value: valueDiff, type: "check", at, date: dateKey });
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

    for (const day of dayMap.values()) {
      day.entries.sort((a, b) => {
        const ta = a.at ? new Date(a.at).getTime() : 0;
        const tb = b.at ? new Date(b.at).getTime() : 0;
        return ta - tb;
      });
    }

    const daysArray = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    const godownUnits = items.reduce((s, i) => s + (i.count ?? 0), 0);

    return NextResponse.json({
      days: daysArray,
      range: {
        from: fromStr,
        to: toStr,
        mode: rangeMode,
        days: rangeDays,
      },
      summary: {
        godownUnits,
        periodIn: totalIn,
        periodOut: totalOut,
        netMovement: totalIn - totalOut,
        hasActivity: daysArray.length > 0,
      },
    });
  } catch (error) {
    console.error("Stock dashboard error:", error);
    return NextResponse.json({ days: [], summary: null }, { status: 500 });
  }
}

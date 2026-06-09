import { toLocalDateString } from "./dateFormat";
import { getDb } from "./mongodb";
import {
  defaultPublicStockDateRange,
  getStockViewStatus,
  type PublicStockActivity,
  type PublicStockSale,
  type StockViewStatus,
} from "./publicStockTypes";
import { itemsLastUserUpdate } from "./stockLastUpdate";
import { serializeStockItem } from "./stockSerialize";

export type { PublicStockActivity, PublicStockSale, StockViewStatus };
export { getStockViewStatus };

const STOCK_FLOW_NOTES = new Set([
  "Stock in",
  "Stock out",
  "Stock in edit",
  "Stock out edit",
  "Stock in deleted - reversed",
  "Stock out deleted - restored",
]);

function isStockFlowNote(note: string): boolean {
  return (
    STOCK_FLOW_NOTES.has(note) ||
    note.startsWith("Stock in") ||
    note.startsWith("Stock out")
  );
}

function parseIsoDate(s: string | null | undefined): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

async function buildActivityMap(
  businessId: string,
  fromStr: string,
  toStr: string
): Promise<Map<string, PublicStockActivity>> {
  const db = await getDb();
  const fromDateStart = new Date(`${fromStr}T00:00:00`);
  const toDateEnd = new Date(`${toStr}T23:59:59.999`);
  const dateFilter = { $gte: fromStr, $lte: toStr };

  const [inRecords, outRecords, history] = await Promise.all([
    db.collection("stock_in").find({ businessId, date: dateFilter }).toArray(),
    db.collection("stock_out").find({ businessId, date: dateFilter }).toArray(),
    db
      .collection("stock_history")
      .find({
        businessId,
        checkDate: { $gte: fromDateStart, $lte: toDateEnd },
      })
      .sort({ checkDate: 1 })
      .toArray(),
  ]);

  const map = new Map<string, PublicStockActivity>();

  function ensure(stockId: string): PublicStockActivity {
    let row = map.get(stockId);
    if (!row) {
      row = {
        periodIn: 0,
        periodOut: 0,
        checkDiff: 0,
        netChange: 0,
        lastDiff: null,
        lastActivityAt: null,
      };
      map.set(stockId, row);
    }
    return row;
  }

  function touch(stockId: string, at: Date | string | null | undefined, diff: number | null) {
    const row = ensure(stockId);
    if (!at) return;
    const iso = new Date(at).toISOString();
    if (!row.lastActivityAt || iso > row.lastActivityAt) {
      row.lastActivityAt = iso;
      if (diff !== null) row.lastDiff = diff;
    }
  }

  for (const r of inRecords) {
    const sid = r.stockId as string;
    const c = r.count ?? 0;
    const row = ensure(sid);
    row.periodIn += c;
    row.netChange += c;
    const at = r.createdAt ?? `${r.date}T12:00:00`;
    touch(sid, at, c);
  }

  for (const r of outRecords) {
    const sid = r.stockId as string;
    const c = r.count ?? 0;
    const row = ensure(sid);
    row.periodOut += c;
    row.netChange -= c;
    const at = r.createdAt ?? `${r.date}T12:00:00`;
    touch(sid, at, -c);
  }

  for (const h of history) {
    const sid = h.stockId as string;
    const note = (h.note as string) || "";
    const diff = h.difference ?? 0;
    const at = h.checkDate as Date;
    touch(sid, at, diff);
    if (!isStockFlowNote(note)) {
      const row = ensure(sid);
      row.checkDiff += diff;
      row.netChange += diff;
    }
  }

  return map;
}

async function fetchSalesRecords(
  businessId: string,
  fromStr: string,
  toStr: string,
  itemMap: Map<string, { name?: string; brand?: string }>
): Promise<PublicStockSale[]> {
  const db = await getDb();
  const records = await db
    .collection("stock_out")
    .find({ businessId, date: { $gte: fromStr, $lte: toStr } })
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  return records.map((r) => {
    const item = itemMap.get(r.stockId as string);
    return {
      _id: r._id?.toString() ?? "",
      stockId: r.stockId as string,
      name: item?.name ?? (r.stockId as string),
      brand: (item?.brand as string) ?? "",
      count: r.count ?? 0,
      note: ((r.note as string) || "").trim(),
      date: (r.date as string) || fromStr,
      createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  });
}

export async function resolvePublicBusinessId(): Promise<string> {
  const env = process.env.PUBLIC_STOCK_BUSINESS_ID?.trim();
  if (env) return env;

  const db = await getDb();
  const top = await db
    .collection("stock")
    .aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$businessId", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ])
    .toArray();
  if (top[0]?._id) return top[0]._id;

  const admin = await db.collection("users").findOne({ isAdmin: true });
  if (admin?.userId) return admin.userId as string;

  const any = await db.collection("users").findOne({});
  return (any?.userId as string) || "default";
}

export type FetchPublicStockOptions = {
  from?: string | null;
  to?: string | null;
  /** Full activity + sales list (heavier). Default false for fast catalogue load. */
  details?: boolean;
};

async function fetchSalesSummary(
  businessId: string,
  fromStr: string,
  toStr: string
): Promise<{ totalPcs: number; count: number }> {
  const db = await getDb();
  const rows = await db
    .collection("stock_out")
    .aggregate<{ totalPcs: number; count: number }>([
      { $match: { businessId, date: { $gte: fromStr, $lte: toStr } } },
      {
        $group: {
          _id: null,
          totalPcs: { $sum: "$count" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  return { totalPcs: rows[0]?.totalPcs ?? 0, count: rows[0]?.count ?? 0 };
}

export async function fetchPublicStockPayload(options?: FetchPublicStockOptions) {
  const businessId = await resolvePublicBusinessId();
  const db = await getDb();

  const defaults = defaultPublicStockDateRange();
  let fromStr = parseIsoDate(options?.from) ?? defaults.from;
  let toStr = parseIsoDate(options?.to) ?? defaults.to;
  if (fromStr > toStr) {
    [fromStr, toStr] = [toStr, fromStr];
  }

  const [user, items] = await Promise.all([
    db.collection("users").findOne({ userId: businessId }),
    db
      .collection("stock")
      .find({ businessId })
      .sort({ name: 1 })
      .toArray(),
  ]);

  const itemMap = new Map(
    items.map((i) => [i._id.toString(), { name: i.name as string, brand: i.brand as string }])
  );

  const includeDetails = options?.details === true;

  let activityMap = new Map<string, PublicStockActivity>();
  let sales: PublicStockSale[] = [];
  let salesSummary: { totalPcs: number; count: number };

  if (includeDetails) {
    const [activity, salesRows, summary] = await Promise.all([
      buildActivityMap(businessId, fromStr, toStr),
      fetchSalesRecords(businessId, fromStr, toStr, itemMap),
      fetchSalesSummary(businessId, fromStr, toStr),
    ]);
    activityMap = activity;
    sales = salesRows;
    salesSummary = {
      totalPcs: summary.totalPcs,
      count: summary.count,
    };
  } else {
    salesSummary = await fetchSalesSummary(businessId, fromStr, toStr);
  }

  const shopTitle =
    process.env.PUBLIC_STOCK_TITLE?.trim() ||
    (user?.name as string) ||
    "Tyre Shop";

  const serialized = items.map((i) => {
    const base = serializeStockItem({ ...i, _id: i._id?.toString() });
    const count = base.count;
    const minStock = base.minStock;
    const id = base._id;
    const activity = includeDetails ? activityMap.get(id) : undefined;
    return {
      ...base,
      status: getStockViewStatus(count, minStock),
      subtitle: [base.brand, base.category, base.size].filter(Boolean).join(" · "),
      ...(activity ? { activity } : {}),
    };
  });

  const lastUserUpdateAt = itemsLastUserUpdate(serialized);

  return {
    businessId,
    shopTitle,
    subtitle: process.env.PUBLIC_STOCK_SUBTITLE?.trim() || "Real-time stock status of all tyre patterns",
    updatedAt: new Date().toISOString(),
    lastUserUpdateAt,
    dateRange: { from: fromStr, to: toStr },
    ...(includeDetails ? { sales } : {}),
    salesSummary,
    items: serialized,
  };
}

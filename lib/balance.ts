import type { Db } from "mongodb";
import { ENTRY_TOTALS_GROUP_FIELDS } from "./entryAmount";
import { buildTotalsBreakdown } from "./totals";

const CACHE_TTL_MS = 15_000;

type CacheEntry = { net: number; expiresAt: number };

const memoryCache = new Map<string, CacheEntry>();

export function invalidateBalanceCache(businessId: string) {
  memoryCache.delete(businessId);
}

export async function computeNetBalance(db: Db, businessId: string): Promise<number> {
  const cached = memoryCache.get(businessId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.net;
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
      { $match: { businessId, deleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          ...ENTRY_TOTALS_GROUP_FIELDS,
        },
      },
    ])
    .toArray();

  const net = row ? buildTotalsBreakdown(row).net : 0;
  memoryCache.set(businessId, { net, expiresAt: Date.now() + CACHE_TTL_MS });
  return net;
}

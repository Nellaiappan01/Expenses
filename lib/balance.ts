import type { Db } from "mongodb";
import { ENTRY_TOTALS_GROUP_FIELDS } from "./entryAmount";
import { buildTotalsBreakdown } from "./totals";

const CACHE_TTL_MS = 15_000;

export type BalanceSummary = {
  net: number;
  pendingApproval: number;
  paymentPending: number;
  totalUnpaid: number;
};

type CacheEntry = { summary: BalanceSummary; expiresAt: number };

const memoryCache = new Map<string, CacheEntry>();

export function invalidateBalanceCache(businessId: string) {
  memoryCache.delete(businessId);
}

export async function computeBalanceSummary(db: Db, businessId: string): Promise<BalanceSummary> {
  const cached = memoryCache.get(businessId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.summary;
  }

  const [row] = await db
    .collection("entries")
    .aggregate<{
      walletIn: number;
      walletOut: number;
      expense: number;
      workerPayment: number;
      adjustment: number;
      pendingApproval: number;
      paymentPending: number;
    }>([
      { $match: { businessId, deleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          ...ENTRY_TOTALS_GROUP_FIELDS,
          pendingApproval: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "expense"] },
                    { $eq: ["$approvalStatus", "pending"] },
                  ],
                },
                { $abs: "$amount" },
                0,
              ],
            },
          },
          paymentPending: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "expense"] },
                    { $eq: ["$approvalStatus", "approved"] },
                    { $eq: ["$paymentStatus", "pending"] },
                  ],
                },
                { $abs: "$amount" },
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  const pendingApproval = row?.pendingApproval ?? 0;
  const paymentPending = row?.paymentPending ?? 0;
  const anchor = await db
    .collection("sheet_tabs")
    .find({ businessId, status: "initialized" })
    .sort({ initializedAt: -1 })
    .limit(1)
    .next();

  let net = row ? buildTotalsBreakdown(row).net : 0;
  if (anchor && anchor.initializedAt) {
    const [movementRow] = await db
      .collection("entries")
      .aggregate<{
        walletIn: number;
        walletOut: number;
        expense: number;
        workerPayment: number;
        adjustment: number;
      }>([
        {
          $match: {
            businessId,
            deleted: { $ne: true },
            createdAt: { $gt: anchor.initializedAt },
          },
        },
        { $group: { _id: null, ...ENTRY_TOTALS_GROUP_FIELDS } },
      ])
      .toArray();
    const movement = movementRow ? buildTotalsBreakdown(movementRow).net : 0;
    net = balanceFromSheetOpening(Number(anchor.openingBalance) || 0, movement);
  }

  const summary: BalanceSummary = {
    net,
    pendingApproval,
    paymentPending,
    totalUnpaid: pendingApproval + paymentPending,
  };

  memoryCache.set(businessId, { summary, expiresAt: Date.now() + CACHE_TTL_MS });
  return summary;
}

/** Opening balance on the website after a new sheet: the sheet anchor, then only later wallet and expense movements. */
export function balanceFromSheetOpening(openingBalance: number, movementNet: number): number {
  const opening = Number.isFinite(openingBalance) ? openingBalance : 0;
  const movement = Number.isFinite(movementNet) ? movementNet : 0;
  return opening + movement;
}

export async function computeNetBalance(db: Db, businessId: string): Promise<number> {
  const summary = await computeBalanceSummary(db, businessId);
  return summary.net;
}

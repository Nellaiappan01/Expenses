import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import {
  buildProfitabilityBreakdown,
  normalizeProfitCategory,
  normalizeProfitRequester,
  sanitizeProfitabilityCategoryRules,
  sanitizeProfitabilityExcludedRequesters,
  type ProfitabilityBucketsConfig,
  type ProfitabilityCategoryRules,
} from "@/lib/profitability";
import type { Entry } from "@/lib/types";

async function assertProfitabilityEnabled(db: Awaited<ReturnType<typeof getDb>>, userId: string) {
  const configDoc = await db.collection("config").findOne({ businessId: userId });
  if (!configDoc?.config?.features?.profitability) {
    return false;
  }
  return true;
}

async function loadBreakdown(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  from: string,
  to: string
) {
  const defaultsDoc = await db.collection("defaults").findOne({ businessId: userId });
  const bucketConfig = (defaultsDoc?.profitabilityBuckets ?? {}) as ProfitabilityBucketsConfig;
  const categoryRules = sanitizeProfitabilityCategoryRules(
    defaultsDoc?.profitabilityCategoryRules
  ) as ProfitabilityCategoryRules;
  const excludedRequesters = sanitizeProfitabilityExcludedRequesters(
    defaultsDoc?.profitabilityExcludedRequesters
  );

  const match: Record<string, unknown> = {
    businessId: userId,
    deleted: { $ne: true },
    type: "expense",
  };

  if (from || to) {
    match.date = {};
    if (from) (match.date as Record<string, string>).$gte = from;
    if (to) (match.date as Record<string, string>).$lte = to;
  }

  const entries = await db
    .collection<Entry>("entries")
    .find(match)
    .project({ category: 1, name: 1, amount: 1, excludeFromProfitability: 1 })
    .toArray();

  const breakdown = buildProfitabilityBreakdown(
    entries as Pick<Entry, "category" | "name" | "amount" | "excludeFromProfitability">[],
    bucketConfig,
    categoryRules,
    excludedRequesters
  );

  return {
    from: from || null,
    to: to || null,
    categoryRules,
    excludedRequesters,
    ...breakdown,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    const db = await getDb();
    if (!(await assertProfitabilityEnabled(db, userId))) {
      return NextResponse.json({ error: "Profitability feature is not enabled" }, { status: 403 });
    }

    const payload = await loadBreakdown(db, userId, from, to);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Profitability API error:", error);
    return NextResponse.json({ error: "Failed to load profitability data" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const requestedBy =
      typeof body.requestedBy === "string"
        ? body.requestedBy.trim()
        : typeof body.requester === "string"
          ? body.requester.trim()
          : "";
    const excluded = body.excluded === true;
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";

    if (!category && !requestedBy) {
      return NextResponse.json(
        { error: "Category or requested by is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    if (!(await assertProfitabilityEnabled(db, userId))) {
      return NextResponse.json({ error: "Profitability feature is not enabled" }, { status: 403 });
    }

    const defaultsDoc = await db.collection("defaults").findOne({ businessId: userId });
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (requestedBy) {
      const key = normalizeProfitRequester(requestedBy);
      let excludedRequesters = sanitizeProfitabilityExcludedRequesters(
        defaultsDoc?.profitabilityExcludedRequesters
      );
      if (excluded) {
        if (!excludedRequesters.includes(key)) excludedRequesters.push(key);
      } else {
        excludedRequesters = excludedRequesters.filter((r) => r !== key);
      }
      update.profitabilityExcludedRequesters = excludedRequesters;
    }

    if (category) {
      const categoryRules = sanitizeProfitabilityCategoryRules(
        defaultsDoc?.profitabilityCategoryRules
      ) as ProfitabilityCategoryRules;
      const key = normalizeProfitCategory(category);
      if (excluded) {
        categoryRules[key] = "exclude";
      } else {
        delete categoryRules[key];
      }
      update.profitabilityCategoryRules = categoryRules;
    }

    await db.collection("defaults").updateOne(
      { businessId: userId },
      {
        $set: update,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    const payload = await loadBreakdown(db, userId, from, to);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Profitability PATCH error:", error);
    return NextResponse.json({ error: "Failed to update profitability filter" }, { status: 500 });
  }
}

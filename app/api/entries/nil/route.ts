import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { ensureExpenseCategory } from "@/lib/expenseDefaultsHelpers";
import { toDateInputValue } from "@/lib/dateFormat";
import { scheduleSheetsAppend } from "@/lib/googleSheetsSync";
import { invalidateBalanceCache } from "@/lib/balance";
import { NIL_DETAIL } from "@/lib/nilEntry";
import type { Entry } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const date = toDateInputValue(String(body.date || ""));
    const rawCategories = Array.isArray(body.categories) ? body.categories : [];
    const categories: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawCategories) {
      const category = String(raw ?? "").trim();
      if (!category || seen.has(category)) continue;
      seen.add(category);
      categories.push(category);
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }
    if (categories.length === 0) {
      return NextResponse.json({ error: "Select at least one category" }, { status: 400 });
    }

    const userId = await getUserId(request);
    const db = await getDb();
    const createdAt = new Date();
    const saved: string[] = [];
    const skipped: string[] = [];

    for (const category of categories) {
      await ensureExpenseCategory(db, userId, category);

      const existing = await db.collection("entries").findOne({
        businessId: userId,
        date,
        isNil: true,
        deleted: { $ne: true },
        category,
      });
      if (existing) {
        skipped.push(category);
        continue;
      }

      const entry: Omit<Entry, "_id"> = {
        type: "expense",
        name: "No work",
        nameLower: "no work",
        amount: 0,
        method: "Cash",
        date,
        category,
        note: NIL_DETAIL,
        isNil: true,
        excludeFromProfitability: true,
        businessId: userId,
        createdAt,
        sheetsSyncStatus: "pending",
      };

      const result = await db.collection("entries").insertOne(entry);
      const entryId = result.insertedId.toString();
      saved.push(category);

      scheduleSheetsAppend(db, userId, entryId);
    }

    if (saved.length > 0) {
      invalidateBalanceCache(userId);
    }

    return NextResponse.json({
      ok: true,
      saved: saved.length,
      skipped: skipped.length,
      categories: saved,
    });
  } catch (error) {
    console.error("[Nil entries]", error);
    return NextResponse.json({ error: "Failed to save Nil" }, { status: 500 });
  }
}

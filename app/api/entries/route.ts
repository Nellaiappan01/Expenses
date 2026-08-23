import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { ensureWorkerCategory, ensureWorkerName } from "@/lib/defaultsHelpers";
import {
  ensureApproverName,
  ensureExpenseCategory,
  ensureExpenseName,
  ensureExpenseTag,
} from "@/lib/expenseDefaultsHelpers";
import {
  appendEntryToGoogleSheets,
  buildSheetsPayload,
  markEntrySyncStatus,
} from "@/lib/googleSheetsSync";
import { invalidateBalanceCache } from "@/lib/balance";
import { getSheetsWebhookUrl } from "@/lib/userSettings";
import type { Entry, EntryInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: EntryInput = await request.json();
    const {
      name,
      amount,
      method,
      date,
      note,
      bankName,
      sender,
      category,
      approvedBy,
      attachmentUrl,
      attachmentPublicId,
      tags,
      type = "expense",
    } = body;

    if (!name?.trim()) {
      const label =
        type === "rotation_cash"
          ? "Description is required"
          : type === "expense"
            ? "Requested by is required"
            : "Worker name is required";
      return NextResponse.json({ error: label }, { status: 400 });
    }
    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      return NextResponse.json({ error: "Amount is required" }, { status: 400 });
    }
    if ((type === "worker_payment" || type === "expense") && !category?.trim()) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }
    if (type === "expense" && !approvedBy?.trim()) {
      return NextResponse.json({ error: "Approved by is required" }, { status: 400 });
    }

    const userId = await getUserId(request);
    const db = await getDb();

    if (type === "worker_payment") {
      await Promise.all([
        ensureWorkerName(db, userId, name),
        ensureWorkerCategory(db, userId, category!.trim()),
      ]);
    }

    if (type === "expense") {
      const tagList = Array.isArray(tags) ? tags.filter((t) => t?.trim()) : [];
      await Promise.all([
        ensureExpenseName(db, userId, name),
        ensureApproverName(db, userId, approvedBy!.trim()),
        ensureExpenseCategory(db, userId, category!.trim()),
        ...tagList.map((tag) => ensureExpenseTag(db, userId, tag)),
      ]);
    }

    const createdAt = new Date();
    const normalizedTags = Array.isArray(tags)
      ? tags.map((t) => t.trim()).filter(Boolean)
      : undefined;

    const entry: Omit<Entry, "_id"> = {
      type,
      name: name.trim(),
      nameLower: name.trim().toLowerCase(),
      amount: Number(amount),
      method: method || "Cash",
      date: date || createdAt.toISOString().split("T")[0],
      category: category?.trim() || undefined,
      note: note?.trim() || undefined,
      bankName: bankName?.trim() || undefined,
      sender: sender?.trim() || undefined,
      approvedBy: approvedBy?.trim() || undefined,
      approvedByLower: approvedBy?.trim().toLowerCase(),
      attachmentUrl: attachmentUrl?.trim() || undefined,
      attachmentPublicId: attachmentPublicId?.trim() || undefined,
      tags: normalizedTags?.length ? normalizedTags : undefined,
      businessId: userId,
      createdAt,
      sheetsSyncStatus: "pending",
    };

    const result = await db.collection("entries").insertOne(entry);
    const entryId = result.insertedId.toString();
    invalidateBalanceCache(userId);
    console.info("[Entries] database save ok:", entryId);

    const payload = buildSheetsPayload({
      type: entry.type,
      date: entry.date,
      name: entry.name,
      category: entry.category ?? "",
      amount: entry.amount,
      method: entry.method,
      note: entry.note ?? "",
      bankName: entry.bankName,
      approvedBy: entry.approvedBy ?? "",
    });

    const sheetsResult = await appendEntryToGoogleSheets(
      payload,
      (await getSheetsWebhookUrl(db, userId)) ?? ""
    );

    if (sheetsResult.ok) {
      await markEntrySyncStatus(db, entryId, userId, "synced");
      console.info(`[Entries] entry ${entryId}: synced`);

      return NextResponse.json(
        {
          ...entry,
          _id: entryId,
          createdAt: createdAt.toISOString(),
          sheetsSyncStatus: "synced" as const,
        },
        { status: 201 }
      );
    }

    await markEntrySyncStatus(db, entryId, userId, "failed", sheetsResult.error);
    console.error(
      `[Entries] entry ${entryId}: sheets sync failed —`,
      sheetsResult.error
    );

    return NextResponse.json(
      {
        error: "Google Sheets sync failed. Entry needs attention.",
        entryId,
        sheetsSyncStatus: "failed" as const,
        sheetsSyncError: sheetsResult.error,
        entry: {
          ...entry,
          _id: entryId,
          createdAt: createdAt.toISOString(),
        },
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("[Entries] database save error:", error);
    return NextResponse.json(
      { error: "Database unavailable. Check MONGODB_URI in .env.local" },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const entries = await db
      .collection("entries")
      .find({ businessId: userId, deleted: { $ne: true } })
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json(
      entries.map((e) => ({
        ...e,
        _id: e._id.toString(),
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching entries:", error);
    return NextResponse.json(
      { error: "Database unavailable. Check MONGODB_URI in .env.local" },
      { status: 503 }
    );
  }
}

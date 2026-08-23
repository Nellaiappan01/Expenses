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
  buildSheetsPayload,
  scheduleSheetsAppend,
  type SheetsWebhookPayload,
} from "@/lib/googleSheetsSync";
import { invalidateBalanceCache } from "@/lib/balance";
import { normalizeStoredAmount } from "@/lib/entryAmount";
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
      paymentDueDate,
      attachmentUrl,
      attachmentPublicId,
      tags,
      excludeFromProfitability,
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

    const userId = await getUserId(request);
    const db = await getDb();

    if (type === "worker_payment") {
      await Promise.all([
        ensureWorkerName(db, userId, name),
        ensureWorkerCategory(db, userId, category!.trim()),
      ]);
    }

    if (type === "expense" && approvedBy?.trim()) {
      await ensureApproverName(db, userId, approvedBy.trim());
    }

    if (type === "expense") {
      const tagList = Array.isArray(tags) ? tags.filter((t) => t?.trim()) : [];
      await Promise.all([
        ensureExpenseName(db, userId, name),
        ensureExpenseCategory(db, userId, category!.trim()),
        ...tagList.map((tag) => ensureExpenseTag(db, userId, tag)),
      ]);
    }

    const createdAt = new Date();
    const normalizedTags = Array.isArray(tags)
      ? tags.map((t) => t.trim()).filter(Boolean)
      : undefined;

    const isExpenseWorkflow = type === "expense";
    const trimmedApproved = approvedBy?.trim();
    const trimmedPaymentDue = paymentDueDate?.trim();

    if (isExpenseWorkflow && trimmedApproved && !trimmedPaymentDue) {
      return NextResponse.json(
        { error: "Payment date is required when Approved by is set" },
        { status: 400 }
      );
    }

    const entry: Omit<Entry, "_id"> = {
      type,
      name: name.trim(),
      nameLower: name.trim().toLowerCase(),
      amount: normalizeStoredAmount(type, Number(amount)),
      method: method || "Cash",
      date: date || createdAt.toISOString().split("T")[0],
      category: category?.trim() || undefined,
      note: note?.trim() || undefined,
      bankName: bankName?.trim() || undefined,
      sender: sender?.trim() || undefined,
      approvedBy: trimmedApproved || undefined,
      approvedByLower: trimmedApproved?.toLowerCase(),
      ...(isExpenseWorkflow
        ? {
            approvalStatus: trimmedApproved ? ("approved" as const) : ("pending" as const),
            paymentStatus: "pending" as const,
            ...(trimmedApproved
              ? { approvedAt: createdAt, paymentDueDate: trimmedPaymentDue }
              : {}),
          }
        : {}),
      attachmentUrl: attachmentUrl?.trim() || undefined,
      attachmentPublicId: attachmentPublicId?.trim() || undefined,
      tags: normalizedTags?.length ? normalizedTags : undefined,
      ...(isExpenseWorkflow && excludeFromProfitability
        ? { excludeFromProfitability: true }
        : {}),
      businessId: userId,
      createdAt,
      sheetsSyncStatus: "pending",
    };

    const result = await db.collection("entries").insertOne(entry);
    const entryId = result.insertedId.toString();
    invalidateBalanceCache(userId);
    console.info("[Entries] database save ok:", entryId);

    const payload: SheetsWebhookPayload = {
      action: "append",
      entryId,
      ...buildSheetsPayload({
        type: entry.type,
        date: entry.date,
        name: entry.name,
        category: entry.category ?? "",
        amount: entry.amount,
        method: entry.method,
        note: entry.note ?? "",
        bankName: entry.bankName,
        approvedBy: entry.approvedBy ?? "",
        approvalStatus: entry.approvalStatus,
        paymentStatus: entry.paymentStatus,
      }),
    };

    scheduleSheetsAppend(db, userId, entryId, payload);

    return NextResponse.json(
      {
        ...entry,
        _id: entryId,
        createdAt: createdAt.toISOString(),
        sheetsSyncStatus: "pending" as const,
      },
      { status: 201 }
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

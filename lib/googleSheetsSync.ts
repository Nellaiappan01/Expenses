import { ObjectId, type Db } from "mongodb";
import { formatIsoDateForSheet } from "./dateFormat";
import { getSheetsWebhookUrl } from "./userSettings";
import type { EntryType, SheetsSyncStatus } from "./types";

export type SheetsMatchFingerprint = {
  date: string;
  requestedBy: string;
  expenseAmount: number;
  addOn: number;
  notes: string;
};

/** Payload sent to Google Apps Script webhook. */
export type SheetsWebhookPayload = {
  action?: "append" | "update" | "delete";
  entryId?: string;
  match?: SheetsMatchFingerprint;
  entryType: EntryType | string;
  date: string;
  category: string;
  expenseAmount: number;
  notes: string;
  addOn: number;
  source: string;
  requestedBy: string;
  approvedBy: string;
  /** Filled when an entry is edited via Adjust (column L in the sheet). */
  adjustReason?: string;
};

export type SheetsSyncResult = {
  ok: boolean;
  status: SheetsSyncStatus;
  error?: string;
  responseStatus?: number;
  responseBody?: string;
};

export function buildSheetsPayload(row: {
  type: EntryType;
  date: string;
  name: string;
  category?: string;
  amount: number;
  method: string;
  note?: string;
  bankName?: string;
  approvedBy?: string;
}): SheetsWebhookPayload {
  const absAmount = Math.abs(Number(row.amount) || 0);
  let category = row.category?.trim() ?? "";
  let expenseAmount = 0;
  let addOn = 0;
  let source = "";
  let requestedBy = "";
  let approvedBy = row.approvedBy?.trim() ?? "";

  if (row.type === "expense") {
    expenseAmount = absAmount;
    requestedBy = row.name.trim();
  } else if (row.type === "rotation_cash") {
    if (row.amount > 0) {
      addOn = row.amount;
      source =
        row.method === "Bank" && row.bankName?.trim()
          ? `${row.method} - ${row.bankName.trim()}`
          : row.method || "Cash";
    } else {
      expenseAmount = absAmount;
      category = category || "Wallet Withdraw";
    }
  } else if (row.type === "worker_payment") {
    expenseAmount = absAmount;
    requestedBy = row.name.trim();
  } else if (row.type === "adjustment") {
    if (row.amount >= 0) {
      addOn = row.amount;
      source = "Adjustment";
    } else {
      expenseAmount = absAmount;
      category = category || "Adjustment";
    }
  }

  return {
    entryType: row.type,
    date: formatIsoDateForSheet(row.date),
    category,
    expenseAmount,
    notes: row.note?.trim() ?? "",
    addOn,
    source,
    requestedBy,
    approvedBy,
  };
}

export function buildSheetsMatch(row: {
  type: EntryType;
  date: string;
  name: string;
  category?: string;
  amount: number;
  method: string;
  note?: string;
  bankName?: string;
  approvedBy?: string;
}): SheetsMatchFingerprint {
  const payload = buildSheetsPayload(row);
  return {
    date: payload.date,
    requestedBy: payload.requestedBy,
    expenseAmount: payload.expenseAmount,
    addOn: payload.addOn,
    notes: payload.notes,
  };
}

function entryDocToSheetsRow(entry: Record<string, unknown>) {
  return {
    type: entry.type as EntryType,
    date: entry.date as string,
    name: entry.name as string,
    category: (entry.category as string) ?? "",
    amount: entry.amount as number,
    method: (entry.method as string) ?? "Cash",
    note: (entry.note as string) ?? "",
    bankName: entry.bankName as string | undefined,
    approvedBy: (entry.approvedBy as string) ?? "",
  };
}

export async function appendEntryToGoogleSheets(
  payload: SheetsWebhookPayload,
  webhookUrl: string
): Promise<SheetsSyncResult> {
  const webhook = webhookUrl.trim();
  if (!webhook) {
    const error = "Apps Script webhook URL is not configured for this account";
    console.error("[Google Sheets] request skipped:", error);
    return { ok: false, status: "failed", error };
  }

  console.info("[Google Sheets] POST", webhook, JSON.stringify(payload));

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseBody = await res.text().catch(() => "");
    console.info("[Google Sheets] response status:", res.status);
    console.info("[Google Sheets] response body:", responseBody || "(empty)");

    if (!res.ok) {
      const error = responseBody || `HTTP ${res.status}`;
      console.error("[Google Sheets] sync failed:", error);
      return {
        ok: false,
        status: "failed",
        error,
        responseStatus: res.status,
        responseBody,
      };
    }

    console.info("[Google Sheets] sync succeeded");
    return { ok: true, status: "synced", responseStatus: res.status, responseBody };
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync_failed";
    console.error("[Google Sheets] request error:", message);
    return { ok: false, status: "failed", error: message };
  }
}

export async function markEntrySyncStatus(
  db: Db,
  entryId: string,
  businessId: string,
  status: SheetsSyncStatus,
  error?: string
) {
  const update: Record<string, unknown> = {
    sheetsSyncStatus: status,
    sheetsSyncError: error ?? null,
  };
  if (status === "synced") {
    update.sheetsSyncedAt = new Date();
  }
  await db.collection("entries").updateOne(
    { _id: new ObjectId(entryId), businessId },
    { $set: update }
  );
}

export async function syncEntryById(
  db: Db,
  businessId: string,
  entryId: string
): Promise<SheetsSyncResult & { entryId: string }> {
  const entry = await db.collection("entries").findOne({
    _id: new ObjectId(entryId),
    businessId,
  });

  if (!entry) {
    return { ok: false, status: "failed", error: "Entry not found", entryId };
  }

  await markEntrySyncStatus(db, entryId, businessId, "pending");

  const payload: SheetsWebhookPayload = {
    action: "append",
    entryId,
    ...buildSheetsPayload(entryDocToSheetsRow(entry)),
  };

  const webhookUrl = (await getSheetsWebhookUrl(db, businessId)) ?? "";
  const result = await appendEntryToGoogleSheets(payload, webhookUrl);

  if (result.ok) {
    await markEntrySyncStatus(db, entryId, businessId, "synced");
  } else {
    await markEntrySyncStatus(db, entryId, businessId, "failed", result.error);
  }

  return { ...result, entryId };
}

/** Sync an edited or deleted entry to Google Sheets (update/delete row + recalc balances). */
export async function syncEntryAdjustment(
  db: Db,
  businessId: string,
  entryId: string,
  action: "update" | "delete",
  entryDoc: Record<string, unknown>,
  originalEntry?: Record<string, unknown>,
  adjustReason?: string
): Promise<SheetsSyncResult> {
  const webhookUrl = (await getSheetsWebhookUrl(db, businessId)) ?? "";
  if (!webhookUrl.trim()) {
    return {
      ok: false,
      status: "failed",
      error: "Apps Script webhook URL is not configured for this account",
    };
  }

  const payload: SheetsWebhookPayload = {
    action,
    entryId,
    match: originalEntry ? buildSheetsMatch(entryDocToSheetsRow(originalEntry)) : undefined,
    ...buildSheetsPayload(entryDocToSheetsRow(entryDoc)),
    adjustReason: adjustReason?.trim() || "",
  };

  if (action === "update") {
    await markEntrySyncStatus(db, entryId, businessId, "pending");
  }

  const result = await appendEntryToGoogleSheets(payload, webhookUrl);

  if (action === "update") {
    if (result.ok) {
      await markEntrySyncStatus(db, entryId, businessId, "synced");
    } else {
      await markEntrySyncStatus(db, entryId, businessId, "failed", result.error);
    }
  }

  return result;
}

export async function retryAllFailedSyncs(db: Db, businessId: string) {
  const failed = await db
    .collection("entries")
    .find({ businessId, sheetsSyncStatus: "failed" })
    .sort({ createdAt: 1 })
    .toArray();

  const results: { entryId: string; ok: boolean; error?: string }[] = [];

  for (const entry of failed) {
    const entryId = entry._id.toString();
    const result = await syncEntryById(db, businessId, entryId);
    results.push({ entryId, ok: result.ok, error: result.error });
  }

  return results;
}

export async function getSheetsSyncCounts(db: Db, businessId: string) {
  const [pending, failed] = await Promise.all([
    db.collection("entries").countDocuments({ businessId, sheetsSyncStatus: "pending" }),
    db.collection("entries").countDocuments({ businessId, sheetsSyncStatus: "failed" }),
  ]);
  return { pending, failed, total: pending + failed };
}

import { ObjectId, type Db } from "mongodb";
import type { SheetsSyncStatus } from "./types";

export type SheetsWebhookPayload = {
  date: string;
  workerName: string;
  category: string;
  amount: number;
  paymentMethod: string;
  note: string;
};

export type SheetsSyncResult = {
  ok: boolean;
  status: SheetsSyncStatus;
  error?: string;
  responseStatus?: number;
  responseBody?: string;
};

export function buildSheetsPayload(row: {
  date: string;
  workerName: string;
  category: string;
  amount: number;
  paymentMethod: string;
  note: string;
}): SheetsWebhookPayload {
  return {
    date: row.date,
    workerName: row.workerName,
    category: row.category,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    note: row.note,
  };
}

export async function appendEntryToGoogleSheets(
  payload: SheetsWebhookPayload
): Promise<SheetsSyncResult> {
  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!webhook) {
    const error = "GOOGLE_SHEETS_WEBHOOK_URL is not configured";
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

  const payload = buildSheetsPayload({
    date: entry.date as string,
    workerName: entry.name as string,
    category: (entry.category as string) ?? "",
    amount: entry.amount as number,
    paymentMethod: entry.method as string,
    note: (entry.note as string) ?? "",
  });

  const result = await appendEntryToGoogleSheets(payload);

  if (result.ok) {
    await markEntrySyncStatus(db, entryId, businessId, "synced");
  } else {
    await markEntrySyncStatus(db, entryId, businessId, "failed", result.error);
  }

  return { ...result, entryId };
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

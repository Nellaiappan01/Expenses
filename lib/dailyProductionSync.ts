import { after } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { formatIsoDateForSheet } from "./dateFormat";
import {
  DAILY_PRODUCTION_CATEGORY,
  DAILY_PRODUCTION_NOTES,
  productionCollection,
} from "./dailyProduction";
import { appendEntryToGoogleSheets, type SheetsSyncResult } from "./googleSheetsSync";
import { getSheetsWebhookUrl } from "./userSettings";

const SHEETS_SYNC_LEASE_MS = 120_000;
const PRODUCTION_SHEET_SCRIPT_HINT =
  "Google Sheet did not take this harvest change. Copy scripts/google-sheets-apps-script.gs, then Deploy → Manage deployments → edit → New version (same URL). Then Update or Delete again.";

function parseSheetsAction(result: SheetsSyncResult): string {
  try {
    const parsed = JSON.parse(result.responseBody || "") as { action?: string };
    return String(parsed?.action || "");
  } catch {
    return "";
  }
}

function confirmProductionSheetWrite(result: SheetsSyncResult): SheetsSyncResult {
  if (!result.ok) return result;
  if (parseSheetsAction(result) === "upsertDailyProduction") return result;
  return {
    ok: false,
    status: "failed",
    error: PRODUCTION_SHEET_SCRIPT_HINT,
    responseStatus: result.responseStatus,
    responseBody: result.responseBody,
  };
}

function confirmProductionSheetDelete(result: SheetsSyncResult): SheetsSyncResult {
  if (!result.ok) return result;
  if (parseSheetsAction(result) === "deleteDailyProduction") return result;
  return {
    ok: false,
    status: "failed",
    error: PRODUCTION_SHEET_SCRIPT_HINT,
    responseStatus: result.responseStatus,
    responseBody: result.responseBody,
  };
}

async function claimProductionSyncLease(
  db: Db,
  productionId: string,
  businessId: string
): Promise<boolean> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + SHEETS_SYNC_LEASE_MS);
  const result = await productionCollection(db).updateOne(
    {
      _id: new ObjectId(productionId),
      businessId,
      $or: [{ sheetsSyncLeaseUntil: { $exists: false } }, { sheetsSyncLeaseUntil: { $lt: now } }],
    },
    { $set: { sheetsSyncLeaseUntil: leaseUntil } }
  );
  return result.modifiedCount > 0;
}

async function persistProductionSyncResult(
  db: Db,
  productionId: string,
  businessId: string,
  result: SheetsSyncResult
) {
  const status = result.ok
    ? "synced"
    : result.timedOut || result.status === "pending"
      ? "pending"
      : "failed";
  const update: Record<string, unknown> = {
    sheetsSyncStatus: status,
    sheetsSyncError: result.ok ? null : result.error ?? null,
  };
  if (result.ok) {
    update.sheetsSyncedAt = new Date();
  }
  await productionCollection(db).updateOne(
    { _id: new ObjectId(productionId), businessId },
    { $set: update, $unset: { sheetsSyncLeaseUntil: "" } }
  );
}

export async function syncDailyProductionToSheets(
  db: Db,
  businessId: string,
  productionId: string
): Promise<SheetsSyncResult> {
  const doc = await productionCollection(db).findOne({
    _id: new ObjectId(productionId),
    businessId,
  });
  if (!doc) {
    return { ok: false, status: "failed", error: "Production not found" };
  }

  const webhookUrl = (await getSheetsWebhookUrl(db, businessId)) ?? "";
  if (!webhookUrl.trim()) {
    const error = "Apps Script webhook URL is not configured for this account";
    await persistProductionSyncResult(db, productionId, businessId, {
      ok: false,
      status: "failed",
      error,
    });
    return { ok: false, status: "failed", error };
  }

  const leased = await claimProductionSyncLease(db, productionId, businessId);
  if (!leased) {
    await productionCollection(db).updateOne(
      { _id: new ObjectId(productionId), businessId },
      { $set: { sheetsSyncLeaseUntil: new Date(Date.now() + SHEETS_SYNC_LEASE_MS) } }
    );
  }

  const result = await appendEntryToGoogleSheets(
    {
      action: "upsertDailyProduction",
      entryId: productionId,
      entryType: "daily_production",
      date: formatIsoDateForSheet(doc.date),
      category: DAILY_PRODUCTION_CATEGORY,
      expenseAmount: 0,
      notes: doc.category?.trim()
        ? `${DAILY_PRODUCTION_NOTES} · ${doc.category.trim()}`
        : DAILY_PRODUCTION_NOTES,
      addOn: 0,
      source: "",
      requestedBy: "",
      approvedBy: "",
      paymentStatus: "",
      tonnage: doc.tonnes,
      tonnes: doc.tonnes,
    },
    webhookUrl
  );

  const confirmed = confirmProductionSheetWrite(result);
  await persistProductionSyncResult(db, productionId, businessId, confirmed);
  return confirmed;
}

export function scheduleDailyProductionSync(db: Db, businessId: string, productionId: string) {
  after(() =>
    syncDailyProductionToSheets(db, businessId, productionId).catch((error) => {
      const message = error instanceof Error ? error.message : "sync_failed";
      console.error(`[Google Sheets] production sync error: ${productionId}`, message);
    })
  );
}

export async function deleteDailyProductionFromSheets(
  db: Db,
  businessId: string,
  productionId: string,
  isoDate: string
): Promise<SheetsSyncResult> {
  const webhookUrl = (await getSheetsWebhookUrl(db, businessId)) ?? "";
  if (!webhookUrl.trim()) {
    return { ok: false, status: "failed", error: "Apps Script webhook URL is not configured for this account" };
  }

  const result = await appendEntryToGoogleSheets(
    {
      action: "deleteDailyProduction",
      entryId: productionId,
      entryType: "daily_production",
      date: formatIsoDateForSheet(isoDate),
      category: DAILY_PRODUCTION_CATEGORY,
      expenseAmount: 0,
      notes: DAILY_PRODUCTION_NOTES,
      addOn: 0,
      source: "",
      requestedBy: "",
      approvedBy: "",
      paymentStatus: "",
    },
    webhookUrl
  );
  return confirmProductionSheetDelete(result);
}

export function scheduleDailyProductionDelete(
  db: Db,
  businessId: string,
  productionId: string,
  isoDate: string
) {
  after(() =>
    deleteDailyProductionFromSheets(db, businessId, productionId, isoDate).catch((error) => {
      const message = error instanceof Error ? error.message : "sync_failed";
      console.error(`[Google Sheets] production delete error: ${productionId}`, message);
    })
  );
}

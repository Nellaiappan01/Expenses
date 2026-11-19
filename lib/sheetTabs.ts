import type { Db } from "mongodb";
import { postAppsScript } from "./googleSheetsSync";
import { getSheetsWebhookUrl } from "./userSettings";
import { invalidateBalanceCache } from "./balance";

export const SHEET_SCRIPT_VERSION = "2026-11-19c";
export const SHEET_TAB_NAME_MAX = 80;
const AMOUNT_LIMIT = 100_000_000_000;
const INIT_LEASE_MS = 60_000;

export type OpeningMode = "carry" | "custom";

export type SheetPreview = {
  activeSheetName: string;
  balanceSheetName: string;
  previousClosing: number | null;
  tabNames: string[];
  scriptVersion: string | null;
};

export type ConfirmedSheetOpening = {
  sheetName: string;
  mode: OpeningMode;
  openingBalance: number;
  previousClosing: number | null;
  previousSheetName: string;
};

export function normalizeSheetTabName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function sheetTabNameKey(name: string): string {
  return normalizeSheetTabName(name).toLowerCase();
}

export function parseOpeningAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return roundRupees(raw);
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[₹,\s]/g, "");
    if (!cleaned) return null;
    const amount = Number(cleaned);
    if (!Number.isFinite(amount)) return null;
    return roundRupees(amount);
  }
  return null;
}

export function openingAmountsMatch(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.009;
}

export function validateSheetTabName(name: string, existingNames: string[]): string | null {
  const trimmed = normalizeSheetTabName(name);
  if (!trimmed) return "Enter a sheet name";
  if (trimmed.length > SHEET_TAB_NAME_MAX) return "Sheet name is too long";
  if (/[\[\]*\/\\?:]/.test(trimmed)) return "Sheet name cannot include [ ] * / \\ ? :";
  const key = trimmed.toLowerCase();
  if (existingNames.some((existing) => sheetTabNameKey(existing) === key)) {
    return "A tab with this name already exists. Its opening balance was not changed.";
  }
  return null;
}

/**
 * Auto carry uses the previous closing exactly once.
 * Custom is the only path that can choose a different amount.
 * A missing previous closing is not treated as zero.
 */
export function resolveNewOpening(input: {
  mode: OpeningMode;
  previousClosing: number | null;
  customAmount: number | null;
}): { ok: true; openingBalance: number; previousClosing: number | null } | { ok: false; error: string } {
  if (input.mode === "carry") {
    if (input.previousClosing === null) {
      return { ok: false, error: "No previous closing balance. Enter a custom opening balance." };
    }
    return {
      ok: true,
      openingBalance: roundRupees(input.previousClosing),
      previousClosing: roundRupees(input.previousClosing),
    };
  }

  if (input.customAmount === null) return { ok: false, error: "Enter the opening balance" };
  if (Math.abs(input.customAmount) > AMOUNT_LIMIT) return { ok: false, error: "Amount is too large" };
  return {
    ok: true,
    openingBalance: roundRupees(input.customAmount),
    previousClosing: input.previousClosing === null ? null : roundRupees(input.previousClosing),
  };
}

export function validateNewSheetRequest(input: {
  sheetName: string;
  mode: OpeningMode;
  customAmount: number | null;
  expectedPreviousSheet: string;
  confirmedOpening: number | null;
  preview: SheetPreview;
}): { ok: true; confirmed: ConfirmedSheetOpening } | { ok: false; error: string } {
  const nameError = validateSheetTabName(input.sheetName, input.preview.tabNames);
  if (nameError) return { ok: false, error: nameError };

  const expected = sheetTabNameKey(input.expectedPreviousSheet);
  const active = sheetTabNameKey(input.preview.activeSheetName);
  if (!expected || expected !== active) {
    return { ok: false, error: "The active sheet changed. Refresh and confirm again." };
  }

  const resolved = resolveNewOpening({
    mode: input.mode,
    previousClosing: input.preview.previousClosing,
    customAmount: input.customAmount,
  });
  if (!resolved.ok) return resolved;

  if (input.confirmedOpening === null || !openingAmountsMatch(input.confirmedOpening, resolved.openingBalance)) {
    return { ok: false, error: "Confirm the opening balance again before creating the sheet." };
  }

  return {
    ok: true,
    confirmed: {
      sheetName: normalizeSheetTabName(input.sheetName),
      mode: input.mode,
      openingBalance: resolved.openingBalance,
      previousClosing: resolved.previousClosing,
      previousSheetName: input.preview.activeSheetName,
    },
  };
}

export function sheetInitClaimDecision(
  existing: { status?: string; leaseUntil?: Date | string | null } | null,
  now: Date
): "insert" | "wait" | "takeover" | "already" {
  if (!existing) return "insert";
  if (existing.status === "initialized") return "already";
  const lease = existing.leaseUntil ? new Date(existing.leaseUntil).getTime() : 0;
  if (Number.isFinite(lease) && lease > now.getTime()) return "wait";
  return "takeover";
}

export function normalizeSheetPreview(data: Record<string, unknown>): SheetPreview | null {
  if (String(data.action || "") !== "previewNewSheet") return null;
  const activeSheetName = typeof data.activeSheetName === "string" ? data.activeSheetName.trim() : "";
  if (!activeSheetName) return null;
  const tabNames = Array.isArray(data.tabNames)
    ? data.tabNames.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    : [];
  const balanceSheetName =
    typeof data.balanceSheetName === "string" && data.balanceSheetName.trim()
      ? data.balanceSheetName.trim()
      : activeSheetName;
  return {
    activeSheetName,
    balanceSheetName,
    previousClosing: parseOpeningAmount(data.previousClosing),
    tabNames,
    scriptVersion: typeof data.scriptVersion === "string" ? data.scriptVersion : null,
  };
}

function roundRupees(amount: number): number {
  return Math.round(amount * 100) / 100;
}

const DEPLOY_HINT = `Deploy Apps Script ${SHEET_SCRIPT_VERSION} from Settings, then try again.`;

export async function readSheetScript(
  webhook: string,
  payload: unknown
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const { response, body } = await postAppsScript(webhook, payload, 20_000);
  const text = body.trim();
  if (!text || text.startsWith("<") || /unable to open the file/i.test(text)) {
    return { ok: false, error: "Google did not run the sheet update. " + DEPLOY_HINT };
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  if (!response.ok || !parsed || parsed.ok !== true) {
    const error = typeof parsed?.error === "string" && parsed.error.trim() ? parsed.error.trim() : "Google Sheets returned an error";
    if (/missing entry data/i.test(error)) return { ok: false, error: DEPLOY_HINT };
    return { ok: false, error };
  }
  return { ok: true, data: parsed };
}

export async function loadSheetPreview(
  db: Db,
  businessId: string
): Promise<{ ok: true; preview: SheetPreview } | { ok: false; error: string }> {
  const webhook = (await getSheetsWebhookUrl(db, businessId)) ?? "";
  if (!webhook) return { ok: false, error: "Add the Apps Script Web App URL in Settings." };
  const result = await readSheetScript(webhook, { action: "previewNewSheet" });
  if (!result.ok) return result;
  const preview = normalizeSheetPreview(result.data);
  if (!preview) return { ok: false, error: DEPLOY_HINT };
  if (preview.scriptVersion !== SHEET_SCRIPT_VERSION) return { ok: false, error: DEPLOY_HINT };
  return { ok: true, preview };
}

export async function createLedgerSheetTab(
  db: Db,
  businessId: string,
  input: {
    sheetName: string;
    mode: OpeningMode;
    customAmount: number | null;
    expectedPreviousSheet: string;
    confirmedOpening: number | null;
  }
): Promise<{ ok: true; sheetName: string; openingBalance: number; previousClosing: number | null } | { ok: false; error: string }> {
  const loaded = await loadSheetPreview(db, businessId);
  if (!loaded.ok) return loaded;

  const validated = validateNewSheetRequest({ ...input, preview: loaded.preview });
  if (!validated.ok) return validated;
  const confirmed = validated.confirmed;

  const claimed = await claimSheetInitialization(db, businessId, confirmed);
  if (!claimed.ok) return claimed;

  const webhook = (await getSheetsWebhookUrl(db, businessId)) ?? "";
  const created = await readSheetScript(webhook, {
    action: "createLedgerSheet",
    confirm: true,
    sheetName: confirmed.sheetName,
    openingMode: confirmed.mode,
    openingBalance: confirmed.openingBalance,
    expectedPreviousSheet: confirmed.previousSheetName,
    previousClosing: confirmed.previousClosing,
  });

  if (!created.ok) {
    await releaseSheetInitialization(db, businessId, confirmed.sheetName);
    return created;
  }
  if (String(created.data.action || "") !== "createLedgerSheet") {
    await releaseSheetInitialization(db, businessId, confirmed.sheetName);
    return { ok: false, error: DEPLOY_HINT };
  }

  const written = parseOpeningAmount(created.data.openingBalance);
  if (written === null || !openingAmountsMatch(written, confirmed.openingBalance)) {
    await releaseSheetInitialization(db, businessId, confirmed.sheetName);
    return { ok: false, error: "Google Sheet did not confirm the opening balance. The tab was not marked ready." };
  }

  await db.collection("sheet_tabs").updateOne(
    { businessId, sheetNameKey: sheetTabNameKey(confirmed.sheetName), status: "creating" },
    {
      $set: {
        status: "initialized",
        openingBalance: written,
        previousClosing: confirmed.previousClosing,
        previousSheetName: confirmed.previousSheetName,
        openingMode: confirmed.mode,
        initializedAt: new Date(),
      },
      $unset: { leaseUntil: "" },
    }
  );

  invalidateBalanceCache(businessId);
  return {
    ok: true,
    sheetName: confirmed.sheetName,
    openingBalance: written,
    previousClosing: confirmed.previousClosing,
  };
}

export async function setActiveSheetOpening(
  db: Db,
  businessId: string,
  input: { amount: number; expectedSheet: string }
): Promise<{ ok: true; sheetName: string; openingBalance: number } | { ok: false; error: string }> {
  const amount = parseOpeningAmount(input.amount);
  const expectedSheet = input.expectedSheet.trim();
  if (amount === null) return { ok: false, error: "Enter the opening balance" };
  if (!expectedSheet) return { ok: false, error: "The active sheet changed. Refresh and confirm again." };

  const webhook = (await getSheetsWebhookUrl(db, businessId)) ?? "";
  if (!webhook) return { ok: false, error: "Add the Apps Script Web App URL in Settings." };
  const saved = await readSheetScript(webhook, {
    action: "setSheetOpening",
    confirm: true,
    openingBalance: amount,
    expectedPreviousSheet: expectedSheet,
  });
  if (!saved.ok) return saved;
  if (String(saved.data.action || "") !== "setSheetOpening") {
    return { ok: false, error: DEPLOY_HINT };
  }
  const written = parseOpeningAmount(saved.data.openingBalance);
  if (written === null || !openingAmountsMatch(written, amount)) {
    return { ok: false, error: "Google Sheet did not save that opening balance." };
  }

  const now = new Date();
  await db.collection("sheet_tabs").updateOne(
    { businessId, sheetNameKey: sheetTabNameKey(expectedSheet) },
    {
      $set: {
        businessId,
        sheetNameKey: sheetTabNameKey(expectedSheet),
        sheetName: expectedSheet,
        status: "initialized",
        openingMode: "custom",
        openingBalance: written,
        initializedAt: now,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  invalidateBalanceCache(businessId);
  return { ok: true, sheetName: expectedSheet, openingBalance: written };
}

async function claimSheetInitialization(
  db: Db,
  businessId: string,
  confirmed: ConfirmedSheetOpening
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date();
  const sheetNameKey = sheetTabNameKey(confirmed.sheetName);
  const collection = db.collection("sheet_tabs");
  const existing = await collection.findOne({ businessId, sheetNameKey });
  const decision = sheetInitClaimDecision(
    existing
      ? {
          status: typeof existing.status === "string" ? existing.status : undefined,
          leaseUntil: existing.leaseUntil instanceof Date || typeof existing.leaseUntil === "string" ? existing.leaseUntil : null,
        }
      : null,
    now
  );
  if (decision === "already") {
    return { ok: false, error: "This sheet was already created. Its opening balance was not changed." };
  }
  if (decision === "wait") {
    return { ok: false, error: "This sheet is already being created. Wait a moment." };
  }

  const leaseUntil = new Date(now.getTime() + INIT_LEASE_MS);
  const fields = {
    businessId,
    sheetNameKey,
    sheetName: confirmed.sheetName,
    status: "creating",
    openingMode: confirmed.mode,
    openingBalance: confirmed.openingBalance,
    previousClosing: confirmed.previousClosing,
    previousSheetName: confirmed.previousSheetName,
    leaseUntil,
    updatedAt: now,
  };

  if (decision === "insert") {
    try {
      await collection.insertOne({ ...fields, createdAt: now });
      return { ok: true };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      return { ok: false, error: "This sheet is already being created. Wait a moment." };
    }
  }

  const taken = await collection.updateOne(
    { businessId, sheetNameKey, status: "creating", leaseUntil: { $lt: now } },
    { $set: fields }
  );
  if (taken.modifiedCount !== 1) {
    return { ok: false, error: "This sheet is already being created. Wait a moment." };
  }
  return { ok: true };
}

async function releaseSheetInitialization(db: Db, businessId: string, sheetName: string) {
  await db.collection("sheet_tabs").deleteOne({
    businessId,
    sheetNameKey: sheetTabNameKey(sheetName),
    status: "creating",
  });
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000;
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { chainFromAnchor } from "./ledgerMath";
import { balanceFromSheetOpening } from "./balance";
import {
  normalizeSheetPreview,
  parseOpeningAmount,
  resolveNewOpening,
  sheetInitClaimDecision,
  validateNewSheetRequest,
  validateSheetTabName,
  type SheetPreview,
} from "./sheetTabs";

const preview: SheetPreview = {
  activeSheetName: "September",
  balanceSheetName: "August",
  previousClosing: 38210,
  tabNames: ["August", "September"],
  scriptVersion: "2026-11-19c",
};

test("auto carry uses the previous closing and does not turn a missing closing into zero", () => {
  const carried = resolveNewOpening({ mode: "carry", previousClosing: 38210, customAmount: null });
  assert.equal(carried.ok, true);
  if (carried.ok) assert.equal(carried.openingBalance, 38210);

  const missing = resolveNewOpening({ mode: "carry", previousClosing: null, customAmount: 0 });
  assert.equal(missing.ok, false);

  const explicitZero = resolveNewOpening({ mode: "carry", previousClosing: 0, customAmount: null });
  assert.equal(explicitZero.ok, true);
  if (explicitZero.ok) assert.equal(explicitZero.openingBalance, 0);
});

test("custom opening is an override and still remembers the previous closing", () => {
  const custom = resolveNewOpening({ mode: "custom", previousClosing: 38210, customAmount: 40000 });
  assert.equal(custom.ok, true);
  if (custom.ok) {
    assert.equal(custom.openingBalance, 40000);
    assert.equal(custom.previousClosing, 38210);
  }
  assert.equal(resolveNewOpening({ mode: "custom", previousClosing: 38210, customAmount: null }).ok, false);
  assert.equal(parseOpeningAmount("₹ 1,250.50"), 1250.5);
});

test("new tab opening carries wallet once and does not replay it", () => {
  const previous = chainFromAnchor(38_210_00, [
    { expensePaise: 0, addonPaise: 100_000, countsExpense: true },
    { expensePaise: 60_000, addonPaise: 0, countsExpense: true },
    { expensePaise: 4_000, addonPaise: 0, countsExpense: true },
  ]);
  const previousClosing = previous[previous.length - 1].closingPaise / 100;
  const carried = resolveNewOpening({
    mode: "carry",
    previousClosing,
    customAmount: null,
  });
  assert.equal(carried.ok, true);
  if (!carried.ok) return;

  assert.equal(carried.openingBalance, 38_210 + 1000 - 600 - 40);
  const seeded = chainFromAnchor(carried.openingBalance * 100, []);
  const seededClosing = seeded.length ? seeded[seeded.length - 1].closingPaise : carried.openingBalance * 100;
  assert.equal(seededClosing / 100, previousClosing);

  const replayed = chainFromAnchor(carried.openingBalance * 100, [
    { expensePaise: 0, addonPaise: 100_000, countsExpense: true },
  ]);
  assert.notEqual(replayed[replayed.length - 1].closingPaise / 100, previousClosing);
});

test("confirmation refuses the wrong tab, a duplicate name, and a stale amount", () => {
  const ready = validateNewSheetRequest({
    sheetName: " November ",
    mode: "carry",
    customAmount: null,
    expectedPreviousSheet: "September",
    confirmedOpening: 38210,
    preview,
  });
  assert.equal(ready.ok, true);
  if (ready.ok) assert.equal(ready.confirmed.sheetName, "November");

  const wrongTab = validateNewSheetRequest({
    sheetName: "November",
    mode: "carry",
    customAmount: null,
    expectedPreviousSheet: "August",
    confirmedOpening: 38210,
    preview,
  });
  assert.equal(wrongTab.ok, false);

  const duplicate = validateSheetTabName("september", preview.tabNames);
  assert.match(duplicate || "", /already exists/);

  const stale = validateNewSheetRequest({
    sheetName: "November",
    mode: "carry",
    customAmount: null,
    expectedPreviousSheet: "September",
    confirmedOpening: 1,
    preview,
  });
  assert.equal(stale.ok, false);
});

test("a second initialization is rejected while the first is still running or already saved", () => {
  const now = new Date("2026-11-19T10:00:00Z");
  assert.equal(sheetInitClaimDecision(null, now), "insert");
  assert.equal(
    sheetInitClaimDecision({ status: "creating", leaseUntil: "2026-11-19T10:00:30Z" }, now),
    "wait"
  );
  assert.equal(
    sheetInitClaimDecision({ status: "creating", leaseUntil: "2026-11-19T09:00:00Z" }, now),
    "takeover"
  );
  assert.equal(sheetInitClaimDecision({ status: "initialized" }, now), "already");
});

test("a new sheet opening is the wallet balance, and later movements are added once", () => {
  assert.equal(balanceFromSheetOpening(50000, 0), 50000);
  assert.equal(balanceFromSheetOpening(50000, -400), 49600);
  assert.equal(balanceFromSheetOpening(0, 1000), 1000);
});

test("preview ignores a response that did not read the active tab", () => {
  assert.equal(normalizeSheetPreview({ ok: true, action: "append" }), null);
  const parsed = normalizeSheetPreview({
    action: "previewNewSheet",
    activeSheetName: "September",
    previousClosing: "38210",
    tabNames: ["September"],
    scriptVersion: "2026-11-19c",
  });
  assert.equal(parsed?.previousClosing, 38210);
  assert.equal(parsed?.balanceSheetName, "September");
});

test("Apps Script creates the new tab without rewriting an existing opening", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "google-sheets-apps-script.gs"), "utf8");
  const start = source.indexOf("function doCreateLedgerSheet_");
  const end = source.indexOf("function doPost", start);
  assert.ok(start > 0);
  const body = source.slice(start, end === -1 ? source.length : end);
  assert.match(body, /A tab with this name already exists/);
  assert.match(body, /insertSheet\(name, ss\.getNumSheets\(\)\)/);
  assert.match(body, /created\.getRange\(2, COL\.OPENING\)\.setValue\(confirmed\)/);
  assert.match(body, /created\.getRange\(2, COL\.CLOSING\)\.setValue\(confirmed\)/);
  assert.doesNotMatch(body, /recalculateFromRow_/);
  assert.match(source, /if \(sheet\.getLastRow\(\) < 2\) return null;/);
  assert.match(source, /This sheet has no opening balance/);
  assert.match(source, /action === "createledgersheet"/);
  assert.match(source, /found\.open\[found\.open\.length - 1\]/);
});

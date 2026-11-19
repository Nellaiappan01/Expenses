/**
 * HARIHARAN SALT WORKS — Google Sheets Apps Script
 *
 * SETUP:
 * 1. Create a Google Sheet with Row 1 headers (exact order):
 *    Date | Opening Balance | Category | Expenses Amount | Notes | Add on | Source | Closing Balance | Requested by | Approved by | Payment Status | Adjust Reason | Entry ID | Tonnage | Drive File URL
 * 2. Extensions → Apps Script → paste this entire file → Save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL into your account settings (or .env for hariharan@gmail.com default)
 * 5. Paste your Google Drive receipts folder URL in Settings / Defaults.
 *    Attachments create a date folder (01 Aug 2026) inside that folder.
 *
 * Column K: Payment Status — Pending Approval / Payment Pending / Paid / Verified
 * Column L: Adjust Reason — filled when an entry is edited in the app
 * Column M: Entry ID — stored automatically for update/delete sync
 * Column N: Tonnage — Daily Production row only; expense updates must not overwrite N
 * Column O: Drive File URL — receipt link in Google Drive
 *
 * Balance rules (must match the app):
 * - Row 2 Opening Balance is the carried opening. Recalculate must not reset it to 0.
 * - Each next row opens from the previous row's closing.
 * - A new tab is created only from the website Sheet card, after the opening balance
 *   is confirmed. Auto carry uses the previous tab's last closing (wallet included once).
 *   A custom amount is an explicit override. B2 is written only on that new empty tab.
 *   Existing tabs and their opening balances are not changed.
 * - Pending Approval, Payment Pending, Rejected, and Nil do not change closing.
 * - Paid / Verified, blank status (wallet, worker, adjustment), and legacy Entry IDs do.
 * - Wallet add increases closing (Add on). Wallet withdraw decreases it (Expenses Amount).
 *
 * Version: 2026-11-19c (confirmed opening on a new tab)
 */

const COL = {
  DATE: 1,
  OPENING: 2,
  CATEGORY: 3,
  EXPENSE: 4,
  NOTES: 5,
  ADD_ON: 6,
  SOURCE: 7,
  CLOSING: 8,
  REQUESTED_BY: 9,
  APPROVED_BY: 10,
  PAYMENT_STATUS: 11,
  ADJUST_REASON: 12,
  ENTRY_ID: 13,
  TONNAGE: 14,
  DRIVE_URL: 15,
};

/** Legacy sheets had Entry ID in column K before Payment Status was added. */
const LEGACY_ENTRY_ID_COL = 11;

function headerLooksLikeDate_(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase();
  return s === "date" || s.indexOf("date") === 0;
}

function headerLooksLikeEntryId_(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return s === "entry id" || s.replace(/ /g, "") === "entryid";
}

function isClosedLedgerHeader_(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return s === "entry id closed" || s.indexOf("entry id closed") === 0;
}

function getOpenLedgerSheets_(ss) {
  const sheets = ss.getSheets();
  const open = [];
  let byEntryIdHeader = null;
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const a1 = sh.getRange(1, COL.DATE).getValue();
    const m1 = sh.getRange(1, COL.ENTRY_ID).getValue();
    if (headerLooksLikeDate_(a1) && headerLooksLikeEntryId_(m1)) {
      open.push(sh);
    } else if (!byEntryIdHeader && headerLooksLikeEntryId_(m1)) {
      byEntryIdHeader = sh;
    }
  }
  return { open: open, byEntryIdHeader: byEntryIdHeader };
}

/** Live tab is the last sheet that still has Date + Entry ID headers. */
function getLedgerSheet_(ss) {
  const found = getOpenLedgerSheets_(ss);
  if (found.open.length) return found.open[found.open.length - 1];
  if (found.byEntryIdHeader) return found.byEntryIdHeader;
  const sheets = ss.getSheets();
  if (sheets.length > 0) return sheets[0];
  return ss.getActiveSheet();
}

function isLedgerTab_(sheet) {
  const a1 = sheet.getRange(1, COL.DATE).getValue();
  const m1 = sheet.getRange(1, COL.ENTRY_ID).getValue();
  if (!headerLooksLikeDate_(a1)) return false;
  return headerLooksLikeEntryId_(m1) || isClosedLedgerHeader_(m1);
}

/** Every ledger tab, including a closed one. Payment status must update the original row. */
function findEntryMatches_(ss, data) {
  const matches = [];
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (!isLedgerTab_(sheets[i])) continue;
    const row = findEntryRow_(sheets[i], data);
    if (row) matches.push({ sheet: sheets[i], row: row });
  }
  return matches;
}

function findEntryAcrossSheets_(ss, data) {
  const matches = findEntryMatches_(ss, data);
  return matches.length ? matches[0] : null;
}

/**
 * Opening for the next row on a tab that already has a balance.
 * An empty tab returns null. It is not silently started at zero.
 * Carry-forward is written to B2 only by doCreateLedgerSheet_.
 */
function openingForAppend_(sheet) {
  if (sheet.getLastRow() < 2) return null;
  return getLastClosingBalance_(sheet);
}

var NO_OPENING_ERROR =
  "This sheet has no opening balance. Open Sheet and confirm the opening balance first.";

function ledgerHeaders_() {
  return [
    "Date",
    "Opening Balance",
    "Category",
    "Expenses Amount",
    "Notes",
    "Add on",
    "Source",
    "Closing Balance",
    "Requested by",
    "Approved by",
    "Payment Status",
    "Adjust Reason",
    "Entry ID",
    "Tonnage",
    "Drive File URL",
  ];
}

function normalizeTabName_(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sheetHasLedgerActivity_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var rows = last - 1;
  var ids = sheet.getRange(2, COL.ENTRY_ID, rows, 1).getValues();
  var cats = sheet.getRange(2, COL.CATEGORY, rows, 1).getValues();
  var expenses = sheet.getRange(2, COL.EXPENSE, rows, 1).getValues();
  var addOns = sheet.getRange(2, COL.ADD_ON, rows, 1).getValues();
  for (var i = 0; i < rows; i++) {
    if (String(ids[i][0] || "").trim()) return true;
    if (String(cats[i][0] || "").trim()) return true;
    var expense = readSheetNumber_(expenses[i][0]);
    var addOn = readSheetNumber_(addOns[i][0]);
    if (expense !== null && expense !== 0) return true;
    if (addOn !== null && addOn !== 0) return true;
  }
  return false;
}

function isBalanceTab_(sheet) {
  var a1 = sheet.getRange(1, COL.DATE).getValue();
  var m1 = sheet.getRange(1, COL.ENTRY_ID).getValue();
  return headerLooksLikeDate_(a1) && (headerLooksLikeEntryId_(m1) || isClosedLedgerHeader_(m1));
}

function previousClosingSnapshot_(ss) {
  var live = getLedgerSheet_(ss);
  var sheets = ss.getSheets();
  var source = null;
  if (live && sheetHasLedgerActivity_(live)) {
    source = live;
  } else {
    for (var i = sheets.length - 1; i >= 0; i--) {
      var sh = sheets[i];
      if (live && sh.getSheetId() === live.getSheetId()) continue;
      if (!isBalanceTab_(sh)) continue;
      if (sh.getLastRow() < 2 || getLastClosingBalance_(sh) === null) continue;
      source = sh;
      break;
    }
  }
  return {
    sheet: live,
    sheetName: live ? live.getName() : "",
    balanceSheetName: source ? source.getName() : "",
    closing: source ? getLastClosingBalance_(source) : null,
  };
}

function widenLedgerColumns_(sheet) {
  var widths = [120, 140, 160, 150, 200, 110, 120, 150, 140, 140, 150, 160, 220, 90, 240];
  for (var c = 0; c < widths.length; c++) {
    sheet.setColumnWidth(c + 1, widths[c]);
  }
  sheet.setFrozenRows(1);
}

/**
 * Write the confirmed opening onto the active tab only when that tab has no entries yet.
 * Does not change any other tab.
 */
function doSetSheetOpening_(data) {
  if (data.confirm !== true) {
    return jsonResponse_({
      ok: false,
      error: "Confirm the opening balance before saving it.",
    });
  }
  var amount = readSheetNumber_(data.openingBalance);
  var expected = normalizeTabName_(data.expectedPreviousSheet);
  if (amount === null) return jsonResponse_({ ok: false, error: "Enter the opening balance" });
  if (Math.abs(amount) > 100000000000) {
    return jsonResponse_({ ok: false, error: "Amount is too large" });
  }

  var live = getLedgerSheet_(SpreadsheetApp.getActiveSpreadsheet());
  if (!live || normalizeTabName_(live.getName()).toLowerCase() !== expected.toLowerCase()) {
    return jsonResponse_({
      ok: false,
      error: "The active sheet changed. Refresh and confirm again.",
    });
  }
  if (sheetHasLedgerActivity_(live)) {
    return jsonResponse_({
      ok: false,
      error: "This sheet already has entries. Its opening balance was not changed.",
    });
  }

  live.getRange(2, COL.OPENING).setValue(amount);
  live.getRange(2, COL.CLOSING).setValue(amount);
  widenLedgerColumns_(live);
  return jsonResponse_({
    ok: true,
    action: "setSheetOpening",
    activeSheetName: live.getName(),
    openingBalance: amount,
  });
}

function doPreviewNewSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prev = previousClosingSnapshot_(ss);
  const names = [];
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) names.push(sheets[i].getName());
  return jsonResponse_({
    ok: true,
    action: "previewNewSheet",
    activeSheetName: prev.sheetName,
    balanceSheetName: prev.balanceSheetName,
    previousClosing: prev.closing,
    tabNames: names,
  });
}

/**
 * Create one new tab in this spreadsheet. Copy row-1 headers.
 * Write the confirmed opening into B2 and the same amount into H2.
 * Do not write any other tab, and do not recalculate historical rows.
 */
function doCreateLedgerSheet_(data) {
  if (data.confirm !== true) {
    return jsonResponse_({
      ok: false,
      error: "Confirm the opening balance before creating the sheet.",
    });
  }

  const name = normalizeTabName_(data.sheetName);
  const mode = String(data.openingMode || "").toLowerCase();
  const expectedPrevious = normalizeTabName_(data.expectedPreviousSheet);
  const confirmed = readSheetNumber_(data.openingBalance);

  if (!name) return jsonResponse_({ ok: false, error: "Enter a sheet name" });
  if (name.length > 80) return jsonResponse_({ ok: false, error: "Sheet name is too long" });
  if (/[\[\]*\/\\?:]/.test(name)) {
    return jsonResponse_({ ok: false, error: "Sheet name cannot include [ ] * / \\ ? :" });
  }
  if (mode !== "carry" && mode !== "custom") {
    return jsonResponse_({ ok: false, error: "Choose Auto Carry Forward or Custom Opening Balance" });
  }
  if (confirmed === null) {
    return jsonResponse_({ ok: false, error: "Enter the opening balance" });
  }
  if (Math.abs(confirmed) > 100000000000) {
    return jsonResponse_({ ok: false, error: "Amount is too large" });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const wanted = name.toLowerCase();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizeTabName_(sheets[i].getName()).toLowerCase() === wanted) {
      return jsonResponse_({
        ok: false,
        error: "A tab with this name already exists. Its opening balance was not changed.",
      });
    }
  }

  const prev = previousClosingSnapshot_(ss);
  if (
    !expectedPrevious ||
    normalizeTabName_(prev.sheetName).toLowerCase() !== expectedPrevious.toLowerCase()
  ) {
    return jsonResponse_({
      ok: false,
      error: "The active sheet changed. Refresh and confirm again.",
    });
  }

  if (mode === "carry") {
    if (prev.closing === null) {
      return jsonResponse_({
        ok: false,
        error: "No previous closing balance. Enter a custom opening balance.",
      });
    }
    if (Math.abs(confirmed - prev.closing) > 0.009) {
      return jsonResponse_({
        ok: false,
        error: "Previous closing changed. Refresh and confirm again.",
      });
    }
  }

  const live = prev.sheet;
  let headers = ledgerHeaders_();
  if (live) {
    const copied = live.getRange(1, 1, 1, 15).getValues()[0];
    if (headerLooksLikeDate_(copied[0])) {
      headers = [];
      const canonical = ledgerHeaders_();
      for (let c = 0; c < 15; c++) {
        const cell = String(copied[c] || "").trim();
        headers.push(cell || canonical[c]);
      }
    }
  }

  const created = ss.insertSheet(name, ss.getNumSheets());
  try {
    created.getRange(1, 1, 1, 15).setValues([headers]);
    if (created.getLastRow() > 1) {
      throw new Error("New tab was not empty");
    }
    created.getRange(2, COL.OPENING).setValue(confirmed);
    created.getRange(2, COL.CLOSING).setValue(confirmed);
    widenLedgerColumns_(created);
  } catch (createErr) {
    try {
      ss.deleteSheet(created);
    } catch (cleanupErr) {
      /* new tab could not be removed */
    }
    return jsonResponse_({ ok: false, error: String(createErr) });
  }

  return jsonResponse_({
    ok: true,
    action: "createLedgerSheet",
    sheetName: created.getName(),
    activeSheetName: created.getName(),
    previousSheetName: prev.balanceSheetName || prev.sheetName,
    previousClosing: prev.closing,
    openingBalance: confirmed,
    openingMode: mode,
  });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || "append").toLowerCase();

    if (action === "uploadattachment") {
      return doUploadAttachment_(data);
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(45000);
      if (action === "previewnewsheet") {
        return doPreviewNewSheet_();
      }
      if (action === "setsheetopening") {
        return doSetSheetOpening_(data);
      }
      if (action === "createledgersheet") {
        return doCreateLedgerSheet_(data);
      }
      const sheet = getLedgerSheet_(SpreadsheetApp.getActiveSpreadsheet());
      ensureDriveHeader_(sheet);
      ensureTonnageHeader_(sheet);

      const entryType = String(data.entryType || "").toLowerCase();
      const isProduction =
        action === "upsertdailyproduction" ||
        action === "deletedailyproduction" ||
        entryType === "daily_production";

      if (isProduction && (action === "deletedailyproduction" || action === "delete")) {
        return doDeleteDailyProduction_(sheet, data);
      }
      if (isProduction) {
        return doUpsertDailyProduction_(sheet, data);
      }

      const hasEntryId = Boolean(String(data.entryId || "").trim());
      if (action === "delete") {
        return doDelete_(sheet, data);
      }
      if (action === "recalculate") {
        return doRecalculate_(sheet);
      }
      if (hasEntryId || action === "update") {
        return doUpsert_(sheet, data);
      }

      return doUpsert_(sheet, data);
    } finally {
      try {
        lock.releaseLock();
      } catch (releaseErr) {
        /* lock not held */
      }
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doUploadAttachment_(data) {
  const folderId = String(data.folderId || "").trim();
  const dateFolderName = String(data.dateFolderName || "").trim();
  const fileName = String(data.fileName || "receipt.jpg").trim() || "receipt.jpg";
  const mimeType = String(data.mimeType || "image/jpeg");
  const base64 = String(data.fileBase64 || "").replace(/^data:[^;]+;base64,/, "");

  if (!folderId) {
    return jsonResponse_({ ok: false, error: "Missing Google Drive folder id" });
  }
  if (!dateFolderName) {
    return jsonResponse_({ ok: false, error: "Missing date folder name" });
  }
  if (!base64) {
    return jsonResponse_({ ok: false, error: "Missing file data" });
  }

  const parent = DriveApp.getFolderById(folderId);
  let dateFolder = null;
  const existing = parent.getFoldersByName(dateFolderName);
  if (existing.hasNext()) {
    dateFolder = existing.next();
  } else {
    dateFolder = parent.createFolder(dateFolderName);
  }

  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
  const file = dateFolder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    /* sharing may be restricted by Workspace policy */
  }

  return jsonResponse_({
    ok: true,
    fileId: file.getId(),
    url: "https://drive.google.com/uc?export=view&id=" + file.getId(),
    driveUrl: file.getUrl(),
    folderId: dateFolder.getId(),
    folderName: dateFolder.getName(),
  });
}

/** For browser test — optional */
function doGet() {
  return jsonResponse_({
    ok: true,
    message: "Site Ledger webhook is running",
    supportsDriveUpload: true,
    scriptVersion: "2026-11-19c",
  });
}

/** Append a new row, or update if this Entry ID already exists (prevents double entries on retry). */
function doUpsert_(sheet, data) {
  const hasEntryId = Boolean(String(data.entryId || "").trim());
  const hasMatch = Boolean(data.match);
  const hasAmount =
    (Number(data.expenseAmount) || 0) !== 0 || (Number(data.addOn) || 0) !== 0;
  const hasDate = Boolean(String(data.date || "").trim());
  if (!hasEntryId && !hasMatch && !hasAmount && !hasDate) {
    return jsonResponse_({ ok: false, error: "Missing entry data" });
  }

  const matches = findEntryMatches_(sheet.getParent(), data);
  if (matches.length) {
    let result = null;
    for (let i = 0; i < matches.length; i++) {
      result = doUpdateAtRow_(matches[i].sheet, data, matches[i].row);
    }
    return result;
  }
  return doAppend_(sheet, data);
}

function doAppend_(sheet, data) {
  const opening = openingForAppend_(sheet);
  if (opening === null) {
    return jsonResponse_({ ok: false, error: NO_OPENING_ERROR });
  }

  const expenseAmount = Number(data.expenseAmount) || 0;
  const addOn = Number(data.addOn) || 0;
  const effectiveExpense = paymentStatusCountsExpense_(data.paymentStatus) ? expenseAmount : 0;

  const row = [
    formatDate_(data.date),
    opening,
    data.category || "",
    expenseAmount || "",
    data.notes || "",
    addOn || "",
    data.source || "",
    opening - effectiveExpense + addOn,
    data.requestedBy || "",
    data.approvedBy || "",
    data.paymentStatus || "",
    data.adjustReason || "",
    data.entryId || "",
    data.tonnage || "",
    data.driveFileUrl || "",
  ];

  sheet.appendRow(row);
  const newRow = sheet.getLastRow();
  recalculateFromRow_(sheet, newRow);

  const closing = Number(sheet.getRange(newRow, COL.CLOSING).getValue()) || 0;
  const openingAfter = Number(sheet.getRange(newRow, COL.OPENING).getValue()) || 0;

  return jsonResponse_({
    ok: true,
    action: "append",
    row: newRow,
    openingBalance: openingAfter,
    closingBalance: closing,
  });
}

function doUpsertDailyProduction_(sheet, data) {
  const productionId = String(data.entryId || "").trim();
  if (!productionId) {
    return jsonResponse_({ ok: false, error: "Missing production id" });
  }
  if (!String(data.date || "").trim()) {
    return jsonResponse_({ ok: false, error: "Missing production date" });
  }

  const formattedDate = formatDate_(data.date);
  const open = getOpenLedgerSheets_(sheet.getParent()).open;
  const targets = open.length ? open : [sheet];
  let home = sheet;
  let keep = 0;
  for (let i = 0; i < targets.length; i++) {
    const candidate = keepOneProductionRow_(targets[i], productionId, formattedDate);
    if (candidate) {
      home = targets[i];
      keep = candidate;
      break;
    }
  }
  const afterExpense = findLastExpenseRowForDate_(home, formattedDate, keep);

  if (keep) {
    return placeDailyProductionRow_(home, data, productionId, keep, afterExpense);
  }
  return placeDailyProductionRow_(sheet, data, productionId, 0, afterExpense);
}

function isBlankLedgerRow_(sheet, r) {
  const cat = String(sheet.getRange(r, COL.CATEGORY).getValue()).trim();
  const notes = String(sheet.getRange(r, COL.NOTES).getValue()).trim();
  const id = String(sheet.getRange(r, COL.ENTRY_ID).getValue()).trim();
  const expense = Number(sheet.getRange(r, COL.EXPENSE).getValue()) || 0;
  const addOn = Number(sheet.getRange(r, COL.ADD_ON).getValue()) || 0;
  return !cat && !notes && !id && !expense && !addOn;
}

function isDailyProductionCategory_(sheet, r) {
  return String(sheet.getRange(r, COL.CATEGORY).getValue()).trim().toLowerCase() === "daily production";
}

function findLastExpenseRowForDate_(sheet, dateValue, skipRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const target = sheetDateKey_(dateValue);
  if (!target) return 0;
  for (let r = lastRow; r >= 2; r--) {
    if (skipRow && r === skipRow) continue;
    if (isDailyProductionCategory_(sheet, r)) continue;
    if (isBlankLedgerRow_(sheet, r)) continue;
    const date = sheetDateKey_(sheet.getRange(r, COL.DATE).getValue());
    if (date === target) return r;
  }
  return 0;
}

function moveRowAfter_(sheet, sourceRow, afterRow) {
  if (!sourceRow || sourceRow < 2 || !afterRow || afterRow < 2) return sourceRow;
  if (sourceRow === afterRow + 1) return sourceRow;

  const lastCol = 15;
  const values = sheet.getRange(sourceRow, 1, 1, lastCol).getValues();
  const backgrounds = sheet.getRange(sourceRow, 1, 1, lastCol).getBackgrounds();
  sheet.deleteRow(sourceRow);

  let after = afterRow;
  if (sourceRow < afterRow) after = afterRow - 1;
  sheet.insertRowAfter(after);
  const newRow = after + 1;
  sheet.getRange(newRow, 1, 1, lastCol).setValues(values);
  sheet.getRange(newRow, 1, 1, lastCol).setBackgrounds(backgrounds);
  return newRow;
}

function placeDailyProductionRow_(sheet, data, productionId, existingRow, afterExpense) {
  let row = existingRow;
  if (!row) {
    if (afterExpense) {
      sheet.insertRowAfter(afterExpense);
      row = afterExpense + 1;
    } else {
      const opening = openingForAppend_(sheet);
      if (opening === null) {
        return jsonResponse_({ ok: false, error: NO_OPENING_ERROR });
      }
      sheet.appendRow([
        formatDate_(data.date),
        opening,
        "Daily Production",
        "",
        productionNotes_(data),
        "",
        "",
        opening,
        "",
        "",
        "",
        "",
        productionId,
        productionTonnageValue_(data),
        "",
      ]);
      row = sheet.getLastRow();
      sheet.getRange(row, 1, 1, 15).setBackground("#FFF8E7");
      recalculateFromRow_(sheet, row);
      const closing = Number(sheet.getRange(row, COL.CLOSING).getValue()) || 0;
      return jsonResponse_({
        ok: true,
        action: "upsertDailyProduction",
        row: row,
        closingBalance: closing,
      });
    }
  }

  const openingSource = afterExpense || (row > 2 ? row - 1 : 0);
  const opening = openingSource
    ? Number(sheet.getRange(openingSource, COL.CLOSING).getValue()) || 0
    : 0;
  writeDailyProductionCells_(sheet, row, data, productionId, opening);

  let placed = row;
  if (afterExpense) {
    placed = moveRowAfter_(sheet, row, afterExpense);
  }

  const recalcFrom = Math.min(afterExpense || placed, placed);
  recalculateFromRow_(sheet, Math.max(2, recalcFrom));

  const closing = Number(sheet.getRange(placed, COL.CLOSING).getValue()) || 0;
  return jsonResponse_({
    ok: true,
    action: "upsertDailyProduction",
    row: placed,
    closingBalance: closing,
  });
}

function findRowByProductionId_(sheet, productionId) {
  const lastRow = sheet.getLastRow();
  const id = String(productionId).trim().toLowerCase();
  if (!id || lastRow < 2) return 0;

  const numRows = lastRow - 1;
  const idValues = sheet.getRange(2, COL.ENTRY_ID, numRows, 1).getValues();
  for (let i = 0; i < numRows; i++) {
    const cellM = String(idValues[i][0]).trim().toLowerCase();
    if (cellM === id) return i + 2;
  }
  return 0;
}

/** Production rows for this Mongo id, plus any Daily Production row on that date (orphan IDs). */
function collectProductionRows_(sheet, productionId, dateValue) {
  const lastRow = sheet.getLastRow();
  const rows = [];
  if (lastRow < 2) return rows;

  const id = String(productionId || "").trim().toLowerCase();
  const target = sheetDateKey_(dateValue);
  const numRows = lastRow - 1;
  const dates = sheet.getRange(2, COL.DATE, numRows, 1).getValues();
  const cats = sheet.getRange(2, COL.CATEGORY, numRows, 1).getValues();
  const ids = sheet.getRange(2, COL.ENTRY_ID, numRows, 1).getValues();

  for (let i = 0; i < numRows; i++) {
    const r = i + 2;
    const cellId = String(ids[i][0]).trim().toLowerCase();
    const isProd = String(cats[i][0]).trim().toLowerCase() === "daily production";
    if (id && cellId === id) {
      rows.push(r);
      continue;
    }
    if (isProd && target && sheetDateKey_(dates[i][0]) === target) {
      rows.push(r);
    }
  }
  return rows;
}

function keepOneProductionRow_(sheet, productionId, dateValue) {
  const rows = collectProductionRows_(sheet, productionId, dateValue);
  if (!rows.length) return 0;

  const id = String(productionId || "").trim().toLowerCase();
  let keep = rows[rows.length - 1];
  if (id) {
    for (let i = 0; i < rows.length; i++) {
      const cellId = String(sheet.getRange(rows[i], COL.ENTRY_ID).getValue())
        .trim()
        .toLowerCase();
      if (cellId === id) {
        keep = rows[i];
        break;
      }
    }
  }

  const descending = rows.slice().sort(function (a, b) {
    return b - a;
  });
  for (let i = 0; i < descending.length; i++) {
    const r = descending[i];
    if (r === keep) continue;
    sheet.deleteRow(r);
    if (r < keep) keep -= 1;
  }
  return keep;
}

function doDeleteDailyProduction_(sheet, data) {
  const productionId = String(data.entryId || "").trim();
  const dateValue = String(data.date || "").trim();
  if (!productionId && !dateValue) {
    return jsonResponse_({ ok: false, error: "Missing production id" });
  }

  const open = getOpenLedgerSheets_(sheet.getParent()).open;
  const targets = open.length ? open : [sheet];
  let deletedRow = 0;
  for (let t = 0; t < targets.length; t++) {
    const target = targets[t];
    const rows = collectProductionRows_(target, productionId, dateValue);
    if (!rows.length) continue;
    const descending = rows.slice().sort(function (a, b) {
      return b - a;
    });
    const first = descending[descending.length - 1];
    for (let i = 0; i < descending.length; i++) {
      target.deleteRow(descending[i]);
    }
    recalculateFromRow_(target, first);
    deletedRow = first;
  }
  if (!deletedRow) {
    return jsonResponse_({ ok: true, action: "deleteDailyProduction", skipped: true });
  }
  return jsonResponse_({ ok: true, action: "deleteDailyProduction", row: deletedRow });
}

function productionTonnageValue_(data) {
  const raw = data.tonnage != null && data.tonnage !== "" ? data.tonnage : data.tonnes;
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

function productionNotes_(data) {
  const notes = String(data.notes || "").trim();
  return notes || "Daily production";
}

function writeDailyProductionCells_(sheet, row, data, productionId, opening) {
  sheet.getRange(row, COL.DATE).setValue(formatDate_(data.date));
  sheet.getRange(row, COL.OPENING).setValue(opening);
  sheet.getRange(row, COL.CATEGORY).setValue("Daily Production");
  sheet.getRange(row, COL.EXPENSE).setValue("");
  sheet.getRange(row, COL.NOTES).setValue(productionNotes_(data));
  sheet.getRange(row, COL.ADD_ON).setValue("");
  sheet.getRange(row, COL.SOURCE).setValue("");
  sheet.getRange(row, COL.CLOSING).setValue(opening);
  sheet.getRange(row, COL.REQUESTED_BY).setValue("");
  sheet.getRange(row, COL.APPROVED_BY).setValue("");
  sheet.getRange(row, COL.PAYMENT_STATUS).setValue("");
  sheet.getRange(row, COL.ENTRY_ID).setValue(productionId);
  sheet.getRange(row, COL.TONNAGE).setValue(productionTonnageValue_(data));
  sheet.getRange(row, 1, 1, 15).setBackground("#FFF8E7");
}

function doUpdate_(sheet, data) {
  return doUpsert_(sheet, data);
}

function doUpdateAtRow_(sheet, data, row) {
  sheet.getRange(row, COL.DATE).setValue(formatDate_(data.date));
  sheet.getRange(row, COL.CATEGORY).setValue(data.category || "");
  sheet.getRange(row, COL.EXPENSE).setValue(data.expenseAmount || "");
  sheet.getRange(row, COL.NOTES).setValue(data.notes || "");
  sheet.getRange(row, COL.ADD_ON).setValue(data.addOn || "");
  sheet.getRange(row, COL.SOURCE).setValue(data.source || "");
  sheet.getRange(row, COL.REQUESTED_BY).setValue(data.requestedBy || "");
  sheet.getRange(row, COL.APPROVED_BY).setValue(data.approvedBy || "");
  if (data.paymentStatus !== undefined) {
    sheet.getRange(row, COL.PAYMENT_STATUS).setValue(data.paymentStatus || "");
  }
  if (data.adjustReason) {
    sheet.getRange(row, COL.ADJUST_REASON).setValue(data.adjustReason);
  }
  if (data.entryId) {
    sheet.getRange(row, COL.ENTRY_ID).setValue(data.entryId);
  }
  if (data.driveFileUrl !== undefined) {
    sheet.getRange(row, COL.DRIVE_URL).setValue(data.driveFileUrl || "");
  }
  if (isDailyProductionPayload_(data)) {
    sheet.getRange(row, COL.EXPENSE).setValue("");
    sheet.getRange(row, COL.TONNAGE).setValue(productionTonnageValue_(data));
    sheet.getRange(row, 1, 1, 15).setBackground("#FFF8E7");
  }

  recalculateFromRow_(sheet, row);

  const closing = Number(sheet.getRange(row, COL.CLOSING).getValue()) || 0;
  return jsonResponse_({ ok: true, action: "update", row: row, closingBalance: closing });
}

function doRecalculate_(sheet) {
  recalculateFromRow_(sheet, 2);
  const lastRow = sheet.getLastRow();
  const closing =
    lastRow >= 2 ? Number(sheet.getRange(lastRow, COL.CLOSING).getValue()) || 0 : 0;
  return jsonResponse_({ ok: true, action: "recalculate", row: lastRow, closingBalance: closing });
}

function doDelete_(sheet, data) {
  const matches = findEntryMatches_(sheet.getParent(), data);
  if (!matches.length) {
    return jsonResponse_({ ok: true, action: "delete", skipped: true });
  }

  const groups = [];
  for (let i = 0; i < matches.length; i++) {
    let group = null;
    for (let g = 0; g < groups.length; g++) {
      if (groups[g].sheet.getSheetId() === matches[i].sheet.getSheetId()) group = groups[g];
    }
    if (!group) {
      group = { sheet: matches[i].sheet, rows: [] };
      groups.push(group);
    }
    group.rows.push(matches[i].row);
  }

  let deletedRow = 0;
  for (let g = 0; g < groups.length; g++) {
    const target = groups[g].sheet;
    const rows = groups[g].rows.sort(function (a, b) {
      return b - a;
    });
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const carriedOpening = row === 2 ? readSheetNumber_(target.getRange(2, COL.OPENING).getValue()) : null;
      target.deleteRow(row);
      if (row === 2 && carriedOpening !== null && target.getLastRow() >= 2) {
        target.getRange(2, COL.OPENING).setValue(carriedOpening);
      }
      recalculateFromRow_(target, row);
      deletedRow = row;
    }
  }

  return jsonResponse_({ ok: true, action: "delete", row: deletedRow });
}

function findEntryRow_(sheet, data) {
  const entryId = String(data.entryId || "").trim();
  if (entryId) {
    return findRowByEntryId_(sheet, entryId);
  }
  if (data.match) {
    return findRowByFingerprint_(sheet, data.match);
  }
  return 0;
}

function findRowByEntryId_(sheet, entryId) {
  const lastRow = sheet.getLastRow();
  const id = String(entryId).trim().toLowerCase();
  if (!id || lastRow < 2) return 0;

  const numRows = lastRow - 1;
  const idValues = sheet.getRange(2, COL.ENTRY_ID, numRows, 1).getValues();
  const legacyValues = sheet.getRange(2, LEGACY_ENTRY_ID_COL, numRows, 1).getValues();

  for (let i = 0; i < numRows; i++) {
    const cellM = String(idValues[i][0]).trim().toLowerCase();
    if (cellM === id) return i + 2;
  }

  for (let i = 0; i < numRows; i++) {
    const cellM = String(idValues[i][0]).trim();
    if (cellM) continue;
    const legacy = String(legacyValues[i][0]).trim().toLowerCase();
    if (legacy === id) return i + 2;
  }

  return 0;
}

function findRowByFingerprint_(sheet, match) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const targetDate = sheetDateKey_(match.date);
  const targetExpense = Number(match.expenseAmount) || 0;
  const targetAddOn = Number(match.addOn) || 0;
  const targetNotes = String(match.notes || "").trim();
  const targetRequested = String(match.requestedBy || "").trim();

  for (let r = 2; r <= lastRow; r++) {
    const date = sheetDateKey_(sheet.getRange(r, COL.DATE).getValue());
    const expense = Number(sheet.getRange(r, COL.EXPENSE).getValue()) || 0;
    const addOn = Number(sheet.getRange(r, COL.ADD_ON).getValue()) || 0;
    const notes = String(sheet.getRange(r, COL.NOTES).getValue()).trim();
    const requestedBy = String(sheet.getRange(r, COL.REQUESTED_BY).getValue()).trim();

    if (
      date === targetDate &&
      requestedBy === targetRequested &&
      expense === targetExpense &&
      addOn === targetAddOn &&
      notes === targetNotes
    ) {
      return r;
    }
  }
  return 0;
}

function recalculateFromRow_(sheet, startRow) {
  const lastRow = sheet.getLastRow();
  if (startRow < 2) startRow = 2;
  if (startRow > lastRow) return;

  const numRows = lastRow - startRow + 1;
  const expenseCol = sheet.getRange(startRow, COL.EXPENSE, numRows, 1).getValues();
  const addOnCol = sheet.getRange(startRow, COL.ADD_ON, numRows, 1).getValues();
  const statusCol = sheet.getRange(startRow, COL.PAYMENT_STATUS, numRows, 1).getValues();

  let prevClosing = 0;
  if (startRow > 2) {
    prevClosing = balanceBeforeRow_(sheet, startRow);
  } else {
    // Never replace the first row's opening with zero. That cell is the previous sheet's closing.
    const anchor = readSheetNumber_(sheet.getRange(2, COL.OPENING).getValue());
    prevClosing = anchor === null ? 0 : anchor;
  }

  const openings = [];
  const closings = [];
  for (let i = 0; i < numRows; i++) {
    const opening = prevClosing;
    const expense = paymentStatusCountsExpense_(statusCol[i][0], true)
      ? Number(expenseCol[i][0]) || 0
      : 0;
    const addOn = Number(addOnCol[i][0]) || 0;
    const closing = opening - expense + addOn;
    openings.push([opening]);
    closings.push([closing]);
    prevClosing = closing;
  }

  sheet.getRange(startRow, COL.OPENING, numRows, 1).setValues(openings);
  sheet.getRange(startRow, COL.CLOSING, numRows, 1).setValues(closings);
}

/**
 * Same rule as lib/ledgerMath.ts sheetStatusCountsExpense.
 * Blank status still counts: wallet withdraw, worker payment, and adjustment have no workflow status.
 */
function paymentStatusCountsExpense_(status, isLegacyHexId) {
  const s = String(status || "").trim();
  if (!s) return true;
  if (s === "Rejected" || s === "Pending Approval" || s === "Payment Pending" || s === "Nil") {
    return false;
  }
  // Legacy sheets stored Entry ID in column K before Payment Status existed.
  if (isLegacyHexId && /^[a-f0-9]{24}$/i.test(s)) return true;
  return true;
}

function readSheetNumber_(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number" && isFinite(value)) return value;
  const cleaned = String(value).replace(/[₹,\s]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isFinite(num) ? num : null;
}

function balanceBeforeRow_(sheet, row) {
  if (row <= 2) {
    const anchor = readSheetNumber_(sheet.getRange(2, COL.OPENING).getValue());
    return anchor === null ? 0 : anchor;
  }
  const closing = readSheetNumber_(sheet.getRange(row - 1, COL.CLOSING).getValue());
  if (closing !== null) return closing;
  const opening = readSheetNumber_(sheet.getRange(row - 1, COL.OPENING).getValue());
  return opening === null ? 0 : opening;
}

function ensureDriveHeader_(sheet) {
  const header = String(sheet.getRange(1, COL.DRIVE_URL).getValue() || "").trim();
  if (!header) {
    sheet.getRange(1, COL.DRIVE_URL).setValue("Drive File URL");
  }
}

function ensureTonnageHeader_(sheet) {
  const header = String(sheet.getRange(1, COL.TONNAGE).getValue() || "").trim();
  if (!header) {
    sheet.getRange(1, COL.TONNAGE).setValue("Tonnage");
  }
}

function getLastClosingBalance_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const closing = readSheetNumber_(sheet.getRange(lastRow, COL.CLOSING).getValue());
  if (closing !== null) return closing;
  return readSheetNumber_(sheet.getRange(lastRow, COL.OPENING).getValue());
}

function sheetDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[value.getDay()] + " " + value.getDate() + " " + months[value.getMonth()] + " " + value.getFullYear();
  }
  return formatDate_(value);
}

function formatDate_(isoDate) {
  if (!isoDate) return "";
  const s = String(isoDate).trim();
  if (/[A-Za-z]{3}/.test(s)) return s;
  const parts = s.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    const date = new Date(y, m, d);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[date.getDay()] + " " + d + " " + months[m] + " " + y;
  }
  return s;
}

function isDailyProductionPayload_(data) {
  const entryType = String(data.entryType || "").toLowerCase();
  const category = String(data.category || "").trim().toLowerCase();
  return entryType === "daily_production" || category === "daily production";
}

function jsonResponse_(obj) {
  obj.scriptVersion = "2026-11-19c";
  obj.supportsDriveUpload = true;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

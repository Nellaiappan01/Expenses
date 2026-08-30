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
 * Version: 2026-08-31b (update/delete production by ID or that date's Daily Production row)
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

function getLedgerSheet_(ss) {
  const sheets = ss.getSheets();
  let byEntryIdHeader = null;
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const a1 = sh.getRange(1, COL.DATE).getValue();
    const m1 = sh.getRange(1, COL.ENTRY_ID).getValue();
    if (headerLooksLikeDate_(a1) && headerLooksLikeEntryId_(m1)) {
      return sh;
    }
    if (!byEntryIdHeader && headerLooksLikeEntryId_(m1)) {
      byEntryIdHeader = sh;
    }
  }
  if (byEntryIdHeader) return byEntryIdHeader;
  if (sheets.length > 0) return sheets[0];
  return ss.getActiveSheet();
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

  const existing = findEntryRow_(sheet, data);
  if (existing) {
    return doUpdateAtRow_(sheet, data, existing);
  }
  return doAppend_(sheet, data);
}

function doAppend_(sheet, data) {
  const lastClosing = getLastClosingBalance_(sheet);
  const opening = lastClosing;

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
  const keep = keepOneProductionRow_(sheet, productionId, formattedDate);
  const afterExpense = findLastExpenseRowForDate_(sheet, formattedDate, keep);

  if (keep) {
    return placeDailyProductionRow_(sheet, data, productionId, keep, afterExpense);
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
      const opening = getLastClosingBalance_(sheet);
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

  const rows = collectProductionRows_(sheet, productionId, dateValue);
  if (!rows.length) {
    return jsonResponse_({ ok: true, action: "deleteDailyProduction", skipped: true });
  }

  const descending = rows.slice().sort(function (a, b) {
    return b - a;
  });
  const first = descending[descending.length - 1];
  for (let i = 0; i < descending.length; i++) {
    sheet.deleteRow(descending[i]);
  }
  recalculateFromRow_(sheet, first);
  return jsonResponse_({ ok: true, action: "deleteDailyProduction", row: first });
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
  const row = findEntryRow_(sheet, data);
  if (!row) {
    return jsonResponse_({ ok: true, action: "delete", skipped: true });
  }

  sheet.deleteRow(row);
  recalculateFromRow_(sheet, row);

  return jsonResponse_({ ok: true, action: "delete", row: row });
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
    prevClosing = Number(sheet.getRange(startRow - 1, COL.CLOSING).getValue()) || 0;
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

function paymentStatusCountsExpense_(status, isLegacyHexId) {
  const s = String(status || "").trim();
  if (s === "Rejected") return false;
  // Legacy sheets stored Entry ID in column K before Payment Status existed
  if (isLegacyHexId && /^[a-f0-9]{24}$/i.test(s)) return true;
  return true;
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
  if (lastRow < 2) return 0;
  const value = sheet.getRange(lastRow, COL.CLOSING).getValue();
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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
  obj.scriptVersion = "2026-08-31b";
  obj.supportsDriveUpload = true;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

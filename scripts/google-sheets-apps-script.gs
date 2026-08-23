/**
 * HARIHARAN SALT WORKS — Google Sheets Apps Script
 *
 * SETUP:
 * 1. Create a Google Sheet with Row 1 headers (exact order):
 *    Date | Opening Balance | Category | Expenses Amount | Notes | Add on | Source | Closing Balance | Requested by | Approved by | Payment Status | Adjust Reason | Entry ID
 * 2. Extensions → Apps Script → paste this entire file → Save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL into your account settings (or .env for hariharan@gmail.com default)
 *
 * Column K: Payment Status — Pending Approval / Payment Pending / Paid / Verified
 * Column L: Adjust Reason — filled when an entry is edited in the app
 * Column M: Entry ID — stored automatically for update/delete sync
 *
 * Version: 2026-08-24 (Payment workflow + admin edit/delete sync)
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
};

/** Legacy sheets had Entry ID in column K before Payment Status was added. */
const LEGACY_ENTRY_ID_COL = 11;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const action = (data.action || "append").toLowerCase();

    if (action === "update") {
      return doUpdate_(sheet, data);
    }
    if (action === "delete") {
      return doDelete_(sheet, data);
    }

    return doAppend_(sheet, data);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/** For browser test — optional */
function doGet() {
  return jsonResponse_({ ok: true, message: "Site Ledger webhook is running" });
}

function doAppend_(sheet, data) {
  const lastClosing = getLastClosingBalance_(sheet);
  const opening = lastClosing;

  const expenseAmount = Number(data.expenseAmount) || 0;
  const addOn = Number(data.addOn) || 0;
  const effectiveExpense = paymentStatusCountsExpense_(data.paymentStatus) ? expenseAmount : 0;
  const closing = opening - effectiveExpense + addOn;

  const row = [
    formatDate_(data.date),
    opening,
    data.category || "",
    expenseAmount || "",
    data.notes || "",
    addOn || "",
    data.source || "",
    closing,
    data.requestedBy || "",
    data.approvedBy || "",
    data.paymentStatus || "",
    data.adjustReason || "",
    data.entryId || "",
  ];

  sheet.appendRow(row);
  const newRow = sheet.getLastRow();

  return jsonResponse_({
    ok: true,
    action: "append",
    row: newRow,
    openingBalance: opening,
    closingBalance: closing,
  });
}

function doUpdate_(sheet, data) {
  const row = findEntryRow_(sheet, data);
  if (!row) {
    return jsonResponse_({
      ok: false,
      error: "Sheet row not found for this entry. Redeploy this script if you recently updated it.",
    });
  }

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

  recalculateFromRow_(sheet, row);

  const closing = Number(sheet.getRange(row, COL.CLOSING).getValue()) || 0;
  return jsonResponse_({ ok: true, action: "update", row: row, closingBalance: closing });
}

function doDelete_(sheet, data) {
  const row = findEntryRow_(sheet, data);
  if (!row) {
    return jsonResponse_({
      ok: false,
      error: "Sheet row not found for this entry. Redeploy this script if you recently updated it.",
    });
  }

  sheet.deleteRow(row);
  recalculateFromRow_(sheet, row);

  return jsonResponse_({ ok: true, action: "delete", row: row });
}

function findEntryRow_(sheet, data) {
  if (data.entryId) {
    const byId = findRowByEntryId_(sheet, data.entryId);
    if (byId) return byId;
  }
  if (data.match) {
    return findRowByFingerprint_(sheet, data.match);
  }
  return 0;
}

function findRowByEntryId_(sheet, entryId) {
  const lastRow = sheet.getLastRow();
  const id = String(entryId).trim();
  if (!id || lastRow < 2) return 0;

  for (let r = 2; r <= lastRow; r++) {
    const cell = String(sheet.getRange(r, COL.ENTRY_ID).getValue()).trim();
    if (cell === id) return r;
  }

  for (let r = 2; r <= lastRow; r++) {
    const cell = String(sheet.getRange(r, LEGACY_ENTRY_ID_COL).getValue()).trim();
    if (cell === id) return r;
  }
  return 0;
}

function findRowByFingerprint_(sheet, match) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const targetDate = formatDate_(match.date);
  const targetExpense = Number(match.expenseAmount) || 0;
  const targetAddOn = Number(match.addOn) || 0;
  const targetNotes = String(match.notes || "");
  const targetRequested = String(match.requestedBy || "");

  for (let r = 2; r <= lastRow; r++) {
    const date = String(sheet.getRange(r, COL.DATE).getValue());
    const expense = Number(sheet.getRange(r, COL.EXPENSE).getValue()) || 0;
    const addOn = Number(sheet.getRange(r, COL.ADD_ON).getValue()) || 0;
    const notes = String(sheet.getRange(r, COL.NOTES).getValue());
    const requestedBy = String(sheet.getRange(r, COL.REQUESTED_BY).getValue());

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

  let prevClosing = 0;
  if (startRow > 2) {
    prevClosing = Number(sheet.getRange(startRow - 1, COL.CLOSING).getValue()) || 0;
  }

  for (let r = startRow; r <= lastRow; r++) {
    const opening = prevClosing;
    const expense = expenseCountsTowardBalance_(sheet, r)
      ? Number(sheet.getRange(r, COL.EXPENSE).getValue()) || 0
      : 0;
    const addOn = Number(sheet.getRange(r, COL.ADD_ON).getValue()) || 0;
    const closing = opening - expense + addOn;

    sheet.getRange(r, COL.OPENING).setValue(opening);
    sheet.getRange(r, COL.CLOSING).setValue(closing);
    prevClosing = closing;
  }
}

function expenseCountsTowardBalance_(sheet, row) {
  const status = String(sheet.getRange(row, COL.PAYMENT_STATUS).getValue()).trim();
  return paymentStatusCountsExpense_(status, true);
}

function paymentStatusCountsExpense_(status, isLegacyHexId) {
  const s = String(status || "").trim();
  if (!s) return true;
  if (s === "Paid / Verified") return true;
  if (s === "Pending Approval" || s === "Payment Pending") return false;
  if (s === "Rejected") return false;
  // Legacy sheets stored Entry ID in column K before Payment Status existed
  if (isLegacyHexId && /^[a-f0-9]{24}$/i.test(s)) return true;
  return true;
}

function getLastClosingBalance_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const value = sheet.getRange(lastRow, COL.CLOSING).getValue();
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

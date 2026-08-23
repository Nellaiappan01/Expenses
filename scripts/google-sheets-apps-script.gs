/**
 * HARIHARAN SALT WORKS — Google Sheets Apps Script
 *
 * SETUP:
 * 1. Create a Google Sheet with Row 1 headers (exact order):
 *    Date | Opening Balance | Category | Expenses Amount | Notes | Add on | Source | Closing Balance | Requested by | Approved by
 * 2. Extensions → Apps Script → paste this entire file → Save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL into your account settings (or .env for hariharan@gmail.com default)
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
};

function doPost(e) {
  try {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  const lastClosing = getLastClosingBalance_(sheet);
  const opening = lastClosing;

  const expenseAmount = Number(data.expenseAmount) || 0;
  const addOn = Number(data.addOn) || 0;
  const closing = opening - expenseAmount + addOn;

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
  ];

  sheet.appendRow(row);

  return jsonResponse_({ ok: true, openingBalance: opening, closingBalance: closing });
  } catch (err) {
  return jsonResponse_({ ok: false, error: String(err) });
  }
}

/** For browser test — optional */
function doGet() {
  return jsonResponse_({ ok: true, message: "Site Ledger webhook is running" });
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
  // Already formatted e.g. Mon 16 Jun 2026 or 16 Jun 2026
  if (/[A-Za-z]{3}/.test(s)) return s;
  // ISO YYYY-MM-DD
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

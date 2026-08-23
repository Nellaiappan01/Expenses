import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { formatIsoDateForSheet } from "@/lib/dateFormat";
import { APP_NAME } from "@/lib/brandAssets";
import { buildLedgerRows, sortEntriesChronologically, sumBalanceDeltas } from "@/lib/ledgerExport";
import { SHEET_COLUMN_PATTERN } from "@/lib/userSettings";
import type { Entry } from "@/lib/types";

const DEFAULT_CONFIG = {
  features: { expenses: true, workers: true, stock: false },
};

/** e.g. Mon 16 Jun 2026 for Excel / Google Sheets (text cells). */
function exportDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return formatIsoDateForSheet(`${y}-${m}-${d}`);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return formatIsoDateForSheet(value.trim());
  }
  if (typeof value === "string") {
    return formatIsoDateForSheet(value);
  }
  return "";
}

function movementDateFilter(
  from: string | null,
  to: string | null
): Record<string, string> | undefined {
  if (!from && !to) return undefined;
  const date: Record<string, string> = {};
  if (from) date.$gte = from;
  if (to) date.$lte = to;
  return date;
}

function claimCreatedFilter(
  from: string | null,
  to: string | null
): Record<string, unknown> | undefined {
  if (!from && !to) return undefined;
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.$gte = new Date(`${from}T00:00:00`);
  if (to) createdAt.$lte = new Date(`${to}T23:59:59.999`);
  return { createdAt };
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B4A8C" },
  };
  row.alignment = { vertical: "middle", wrapText: true };
}

function styleCurrencyColumns(ws: ExcelJS.Worksheet, columns: number[]) {
  for (let r = 2; r <= ws.rowCount; r++) {
    for (const col of columns) {
      const cell = ws.getRow(r).getCell(col);
      if (typeof cell.value === "number") {
        cell.numFmt = "#,##0.00";
      }
    }
  }
}

function buildEntrySearchFilter(search: string) {
  const searchLower = search.toLowerCase();
  return {
    $or: [
      { nameLower: { $regex: searchLower, $options: "i" } },
      { note: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { approvedByLower: { $regex: searchLower, $options: "i" } },
      { sender: { $regex: search, $options: "i" } },
      { bankName: { $regex: search, $options: "i" } },
    ],
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search")?.trim();

    const userId = await getUserId(request);
    const db = await getDb();

    const configDoc = await db.collection("config").findOne({ businessId: userId });
    const config = {
      ...DEFAULT_CONFIG,
      ...configDoc?.config,
      features: { ...DEFAULT_CONFIG.features, ...configDoc?.config?.features },
    };
    const features = config.features ?? DEFAULT_CONFIG.features;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = APP_NAME;
    workbook.created = new Date();
    const dateStr = new Date().toISOString().split("T")[0];

    const entryMatch: Record<string, unknown> = {
      businessId: userId,
      deleted: { $ne: true },
    };
    if (from || to) {
      entryMatch.date = {};
      if (from) (entryMatch.date as Record<string, string>).$gte = from;
      if (to) (entryMatch.date as Record<string, string>).$lte = to;
    }
    if (search) {
      Object.assign(entryMatch, buildEntrySearchFilter(search));
    }

    const ledgerTypes: Entry["type"][] = [];
    if (features.expenses) {
      ledgerTypes.push("expense", "rotation_cash", "adjustment");
    }
    if (features.workers) {
      ledgerTypes.push("worker_payment");
    }

    let walletTotal = 0;
    let expenseTotal = 0;
    let workerTotal = 0;
    let startingBalance = 0;
    let closingBalance = 0;

    if (ledgerTypes.length > 0) {
      if (from) {
        const priorEntries = await db
          .collection<Entry>("entries")
          .find({
            businessId: userId,
            deleted: { $ne: true },
            type: { $in: ledgerTypes },
            date: { $lt: from },
          })
          .toArray();
        startingBalance = sumBalanceDeltas(priorEntries);
      }

      const ledgerEntries = await db
        .collection<Entry>("entries")
        .find({ ...entryMatch, type: { $in: ledgerTypes } })
        .toArray();

      const ledgerRows = buildLedgerRows(ledgerEntries, startingBalance);

      const ledgerWs = workbook.addWorksheet("Ledger", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      ledgerWs.columns = [
        { header: "Date", key: "date", width: 16 },
        { header: "Opening Balance", key: "openingBalance", width: 16 },
        { header: "Category", key: "category", width: 18 },
        { header: "Expenses Amount", key: "expensesAmount", width: 16 },
        { header: "Notes", key: "notes", width: 28 },
        { header: "Add on", key: "addOn", width: 14 },
        { header: "Source", key: "source", width: 18 },
        { header: "Closing Balance", key: "closingBalance", width: 16 },
        { header: "Requested by", key: "requestedBy", width: 18 },
        { header: "Approved by", key: "approvedBy", width: 18 },
        { header: "Payment Status", key: "paymentStatus", width: 18 },
      ];
      styleHeader(ledgerWs);
      for (const row of ledgerRows) {
        ledgerWs.addRow(row);
      }
      styleCurrencyColumns(ledgerWs, [2, 4, 6, 8]);

      if (ledgerRows.length > 0) {
        closingBalance = ledgerRows[ledgerRows.length - 1].closingBalance;
        const totalRow = ledgerWs.addRow({
          date: "Closing balance",
          closingBalance,
        });
        totalRow.font = { bold: true };
        styleCurrencyColumns(ledgerWs, [8]);
      }

      const sortedForTotals = sortEntriesChronologically(ledgerEntries);
      for (const e of sortedForTotals) {
        if (e.type === "rotation_cash") walletTotal += e.amount;
        else if (e.type === "expense" || e.type === "adjustment") expenseTotal += e.amount;
        else if (e.type === "worker_payment") workerTotal += e.amount;
      }
    }

    if (features.expenses || features.workers) {
      const summaryWs = workbook.addWorksheet("Summary", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      summaryWs.columns = [
        { header: "Section", key: "label", width: 28 },
        { header: "Amount (₹)", key: "amount", width: 18 },
      ];
      styleHeader(summaryWs);
      summaryWs.addRow({ label: "Wallet net (add − withdraw)", amount: walletTotal });
      summaryWs.addRow({ label: "Expenses & adjustments", amount: expenseTotal });
      if (features.workers) {
        summaryWs.addRow({ label: "Worker payments", amount: workerTotal });
      }
      summaryWs.addRow([]);
      summaryWs.addRow({ label: "Closing balance", amount: closingBalance });
      summaryWs.getRow(summaryWs.rowCount).font = { bold: true };
      summaryWs.addRow([]);
      summaryWs.addRow({ label: "Columns", amount: "" });
      summaryWs.addRow({ label: SHEET_COLUMN_PATTERN, amount: "" });
    }

    // Legacy per-type sheets removed — Ledger sheet matches Google Sheets / entry form.

    if (features.stock) {
      const items = await db
        .collection("stock")
        .find({ businessId: userId })
        .sort({ name: 1 })
        .toArray();
      const itemMap = new Map(
        items.map((i) => [(i as { _id: { toString(): string } })._id.toString(), i])
      );

      const dateFilter = movementDateFilter(from, to);

      const godownWs = workbook.addWorksheet("Godown Stock", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      godownWs.columns = [
        { header: "Product", key: "name", width: 36 },
        { header: "Count", key: "count", width: 12 },
        { header: "Last check", key: "lastCheck", width: 20 },
      ];
      styleHeader(godownWs);
      let totalCount = 0;
      for (const i of items) {
        const count = i.count ?? 0;
        totalCount += count;
        godownWs.addRow({
          name: i.name ?? "",
          count,
          lastCheck: i.lastCheckAt ? exportDate(i.lastCheckAt) : "",
        });
      }
      godownWs.addRow([]);
      godownWs.addRow({ name: "Total", count: totalCount });
      godownWs.getRow(godownWs.rowCount).font = { bold: true };

      const stockInMatch: Record<string, unknown> = { businessId: userId };
      if (dateFilter) stockInMatch.date = dateFilter;
      const stockInRecords = await db
        .collection("stock_in")
        .find(stockInMatch)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      const inWs = workbook.addWorksheet("Stock In", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      inWs.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Product", key: "name", width: 28 },
        { header: "Qty", key: "count", width: 10 },
        { header: "Note", key: "note", width: 24 },
      ];
      styleHeader(inWs);
      let inQty = 0;
      for (const r of stockInRecords) {
        const item = itemMap.get(r.stockId as string);
        const qty = r.count ?? 0;
        inQty += qty;
        inWs.addRow({
          date: exportDate(r.date),
          name: (item?.name as string) ?? r.stockId,
          count: qty,
          note: r.note ?? "",
        });
      }
      inWs.addRow([]);
      inWs.addRow({ date: "Total", name: "", count: inQty });
      inWs.getRow(inWs.rowCount).font = { bold: true };

      const stockOutMatch: Record<string, unknown> = { businessId: userId };
      if (dateFilter) stockOutMatch.date = dateFilter;
      const stockOutRecords = await db
        .collection("stock_out")
        .find(stockOutMatch)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      const outWs = workbook.addWorksheet("Stock Out", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      outWs.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Product", key: "name", width: 28 },
        { header: "Qty", key: "count", width: 10 },
        { header: "Note", key: "note", width: 24 },
      ];
      styleHeader(outWs);
      let outQty = 0;
      for (const r of stockOutRecords) {
        const item = itemMap.get(r.stockId as string);
        const qty = r.count ?? 0;
        outQty += qty;
        outWs.addRow({
          date: exportDate(r.date),
          name: (item?.name as string) ?? r.stockId,
          count: qty,
          note: r.note ?? "",
        });
      }
      outWs.addRow([]);
      outWs.addRow({ date: "Total", name: "", count: outQty });
      outWs.getRow(outWs.rowCount).font = { bold: true };

      const claimMatch: Record<string, unknown> = { businessId: userId };
      const createdFilter = claimCreatedFilter(from, to);
      if (createdFilter) Object.assign(claimMatch, createdFilter);

      const claims = await db
        .collection("stock_requests")
        .find(claimMatch)
        .sort({ createdAt: -1 })
        .toArray();

      const claimWs = workbook.addWorksheet("Claim", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      claimWs.columns = [
        { header: "Created", key: "created", width: 14 },
        { header: "Resolved", key: "resolved", width: 14 },
        { header: "Status", key: "status", width: 12 },
        { header: "Customer", key: "customer", width: 18 },
        { header: "Mobile", key: "mobile", width: 14 },
        { header: "Product", key: "product", width: 28 },
        { header: "Qty", key: "qty", width: 8 },
        { header: "Issue", key: "issue", width: 22 },
        { header: "Resolution note", key: "resolution", width: 22 },
      ];
      styleHeader(claimWs);
      for (const c of claims) {
        const item = itemMap.get(c.stockId as string);
        claimWs.addRow({
          created: exportDate(c.createdAt),
          resolved: c.resolvedAt ? exportDate(c.resolvedAt) : "",
          status: c.status ?? "",
          customer: c.customerName ?? "",
          mobile: c.customerPhone ?? "",
          product: (item?.name as string) ?? c.stockId,
          qty: c.qty ?? 1,
          issue: c.note ?? "",
          resolution: c.resolutionNote ?? "",
        });
      }
    }

    if (workbook.worksheets.length === 0) {
      return NextResponse.json({ error: "No features enabled for export" }, { status: 400 });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting report:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

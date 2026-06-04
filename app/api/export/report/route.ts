import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { formatDayMonthYear } from "@/lib/dateFormat";
import type { Entry } from "@/lib/types";

const DEFAULT_CONFIG = {
  features: { expenses: true, workers: true, stock: false },
};

/** e.g. 06 April 2026 for Excel / Google Sheets (text cells). */
function exportDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return formatDayMonthYear(`${value.trim()}T12:00:00`);
  }
  return formatDayMonthYear(value as Date | string);
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
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
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
    workbook.creator = "Cash Flow Ledger";
    workbook.created = new Date();
    const dateStr = new Date().toISOString().split("T")[0];

    const entryMatch: Record<string, unknown> = { businessId: userId };
    if (from || to) {
      entryMatch.date = {};
      if (from) (entryMatch.date as Record<string, string>).$gte = from;
      if (to) (entryMatch.date as Record<string, string>).$lte = to;
    }
    if (search) {
      const searchLower = search.toLowerCase();
      entryMatch.$or = [
        { nameLower: { $regex: searchLower, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
      ];
    }

    let walletTotal = 0;
    let expenseTotal = 0;
    let workerTotal = 0;

    if (features.expenses) {
      const [expenseEntries, walletEntries] = await Promise.all([
        db
          .collection<Entry>("entries")
          .find({ ...entryMatch, type: { $in: ["expense", "adjustment"] as const } })
          .toArray(),
        db
          .collection<Entry>("entries")
          .find({ ...entryMatch, type: "rotation_cash" as const })
          .toArray(),
      ]);
      expenseTotal = expenseEntries.reduce((s, e) => s + e.amount, 0);
      walletTotal = walletEntries.reduce((s, e) => s + e.amount, 0);
    }
    if (features.workers) {
      const workerEntries = await db
        .collection<Entry>("entries")
        .find({ ...entryMatch, type: "worker_payment" as const })
        .toArray();
      workerTotal = workerEntries.reduce((s, e) => s + e.amount, 0);
    }

    if (features.expenses || features.workers) {
      const summaryWs = workbook.addWorksheet("Summary", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      summaryWs.columns = [
        { header: "Section", key: "label", width: 22 },
        { header: "Amount (₹)", key: "amount", width: 18 },
      ];
      styleHeader(summaryWs);
      summaryWs.addRow({ label: "Wallet Total", amount: walletTotal });
      summaryWs.addRow({ label: "Expenses Total", amount: expenseTotal });
      summaryWs.addRow({ label: "Workers Total", amount: workerTotal });
      summaryWs.addRow([]);
      const currentValue = walletTotal - Math.abs(expenseTotal) - Math.abs(workerTotal);
      summaryWs.addRow({ label: "Current Value", amount: currentValue });
      summaryWs.getRow(summaryWs.rowCount).font = { bold: true };
    }

    if (features.expenses) {
      const expenseMatch = {
        ...entryMatch,
        type: { $in: ["expense", "adjustment"] as const },
      };
      const entries = await db
        .collection<Entry>("entries")
        .find(expenseMatch)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      const ws = workbook.addWorksheet("Expenses", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Type", key: "type", width: 14 },
        { header: "Name", key: "name", width: 22 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Method", key: "method", width: 10 },
        { header: "Bank", key: "bank", width: 14 },
        { header: "Sender", key: "sender", width: 14 },
        { header: "Note", key: "note", width: 24 },
      ];
      styleHeader(ws);
      for (const e of entries) {
        ws.addRow({
          date: exportDate(e.date),
          type: e.type.replace("_", " "),
          name: e.name || "",
          amount: e.amount,
          method: e.method,
          bank: e.bankName ?? "",
          sender: e.sender ?? "",
          note: e.note ?? "",
        });
      }
      ws.addRow([]);
      ws.addRow({ date: "Total", name: "", amount: expenseTotal });
      ws.getRow(ws.rowCount).font = { bold: true };
    }

    if (features.expenses) {
      const walletMatch = {
        ...entryMatch,
        type: "rotation_cash" as const,
      };
      const entries = await db
        .collection<Entry>("entries")
        .find(walletMatch)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      const ws = workbook.addWorksheet("Wallet", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Name", key: "name", width: 22 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Method", key: "method", width: 10 },
        { header: "Bank", key: "bank", width: 14 },
        { header: "Sender", key: "sender", width: 14 },
        { header: "Note", key: "note", width: 24 },
      ];
      styleHeader(ws);
      for (const e of entries) {
        ws.addRow({
          date: exportDate(e.date),
          name: e.name || "",
          amount: e.amount,
          method: e.method,
          bank: e.bankName ?? "",
          sender: e.sender ?? "",
          note: e.note ?? "",
        });
      }
      ws.addRow([]);
      ws.addRow({ date: "Total", name: "", amount: walletTotal });
      ws.getRow(ws.rowCount).font = { bold: true };
    }

    if (features.workers) {
      const workerMatch = {
        ...entryMatch,
        type: "worker_payment" as const,
      };
      const entries = await db
        .collection<Entry>("entries")
        .find(workerMatch)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      const ws = workbook.addWorksheet("Workers", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Name", key: "name", width: 22 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Method", key: "method", width: 10 },
        { header: "Bank", key: "bank", width: 14 },
        { header: "Sender", key: "sender", width: 14 },
        { header: "Note", key: "note", width: 24 },
      ];
      styleHeader(ws);
      for (const e of entries) {
        ws.addRow({
          date: exportDate(e.date),
          name: e.name || "",
          amount: e.amount,
          method: e.method,
          bank: e.bankName ?? "",
          sender: e.sender ?? "",
          note: e.note ?? "",
        });
      }
      ws.addRow([]);
      ws.addRow({ date: "Total", name: "", amount: workerTotal });
      ws.getRow(ws.rowCount).font = { bold: true };
    }

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

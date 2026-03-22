import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import type { Entry } from "@/lib/types";

const DEFAULT_CONFIG = {
  features: { expenses: true, workers: true, stock: false },
};

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

    // Sheet 1: Expenses (expense, rotation_cash, adjustment)
    if (features.expenses) {
      const expenseMatch = {
        ...entryMatch,
        type: { $in: ["expense", "rotation_cash", "adjustment"] as const },
      };
      const entries = await db
        .collection<Entry>("entries")
        .find(expenseMatch)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      const ws = workbook.addWorksheet("Expenses", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Date", key: "date", width: 12 },
        { header: "Type", key: "type", width: 14 },
        { header: "Name", key: "name", width: 22 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Method", key: "method", width: 10 },
        { header: "Bank", key: "bank", width: 14 },
        { header: "Sender", key: "sender", width: 14 },
        { header: "Note", key: "note", width: 24 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const e of entries) {
        ws.addRow({
          date: e.date,
          type: e.type === "rotation_cash" ? "Wallet" : e.type.replace("_", " "),
          name: e.name || "",
          amount: e.amount,
          method: e.method,
          bank: e.bankName ?? "",
          sender: e.sender ?? "",
          note: e.note ?? "",
        });
      }
    }

    // Sheet 2: Workers (worker_payment)
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
        { header: "Date", key: "date", width: 12 },
        { header: "Name", key: "name", width: 22 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Method", key: "method", width: 10 },
        { header: "Bank", key: "bank", width: 14 },
        { header: "Sender", key: "sender", width: 14 },
        { header: "Note", key: "note", width: 24 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const e of entries) {
        ws.addRow({
          date: e.date,
          name: e.name || "",
          amount: e.amount,
          method: e.method,
          bank: e.bankName ?? "",
          sender: e.sender ?? "",
          note: e.note ?? "",
        });
      }
    }

    // Sheet 3: Stock
    if (features.stock) {
      const items = await db
        .collection("stock")
        .find({ businessId: userId })
        .sort({ name: 1 })
        .toArray();

      const history = await db
        .collection("stock_history")
        .find({ businessId: userId })
        .sort({ checkDate: -1 })
        .limit(500)
        .toArray();

      const itemMap = new Map(
        items.map((i) => [(i as { _id: { toString(): string } })._id.toString(), i])
      );

      const ws = workbook.addWorksheet("Stock", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Stock Name", key: "name", width: 20 },
        { header: "Count", key: "count", width: 10 },
        { header: "Value/Unit (₹)", key: "valuePerUnit", width: 14 },
        { header: "Total Value (₹)", key: "totalValue", width: 14 },
        { header: "Last Check", key: "lastCheck", width: 18 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const i of items) {
        const total = (i.count ?? 0) * (i.valuePerUnit ?? 0);
        const lastCheck = i.lastCheckAt
          ? new Date(i.lastCheckAt).toLocaleString("en-IN")
          : "";
        ws.addRow({
          name: i.name ?? "",
          count: i.count ?? 0,
          valuePerUnit: i.valuePerUnit ?? 0,
          totalValue: total.toFixed(2),
          lastCheck,
        });
      }

      if (history.length > 0) {
        ws.addRow([]);
        ws.addRow(["Check History"]);
        ws.getRow(ws.rowCount).font = { bold: true };
        ws.addRow(["Stock Name", "Check Date", "Current Stock", "Difference"]);
        ws.getRow(ws.rowCount).font = { bold: true };
        for (const h of history) {
          const item = itemMap.get(h.stockId);
          const name = item?.name ?? h.stockId;
          const date = h.checkDate
            ? new Date(h.checkDate).toLocaleString("en-IN")
            : "";
          ws.addRow([name, date, h.newCount, h.difference >= 0 ? `+${h.difference}` : h.difference]);
        }
      }
    }

    if (workbook.worksheets.length === 0) {
      return NextResponse.json({ error: "No features enabled for export" }, { status: 400 });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting report:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}

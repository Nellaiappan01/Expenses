import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const historyOnly = type === "history";

    const userId = await getUserId(request);
    const db = await getDb();

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

    const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

    const rows: string[] = [];

    if (historyOnly) {
      rows.push("Stock Check History");
      rows.push(`Generated,${new Date().toISOString().split("T")[0]}`);
      rows.push("");
      rows.push(
        ["Stock Name", "Check Date", "Previous Count", "New Count", "Difference"].join(",")
      );
      for (const h of history) {
        const item = itemMap.get(h.stockId);
        const name = item?.name ?? h.stockId;
        const date = h.checkDate
          ? new Date(h.checkDate).toLocaleString("en-IN")
          : "";
        rows.push(
          [
            escapeCsv(name),
            escapeCsv(date),
            h.previousCount,
            h.newCount,
            h.difference >= 0 ? `+${h.difference}` : h.difference,
          ].join(",")
        );
      }
    } else {
      rows.push("Stock Check Report");
      rows.push(`Generated,${new Date().toISOString().split("T")[0]}`);
      rows.push("");

      rows.push("Stock Summary");
      rows.push(["Name", "Count", "Value/Unit (₹)", "Total Value (₹)", "Last Check"].join(","));
      for (const i of items) {
        const total = (i.count ?? 0) * (i.valuePerUnit ?? 0);
        const lastCheck = i.lastCheckAt
          ? new Date(i.lastCheckAt).toLocaleString("en-IN")
          : "";
        rows.push(
          [
            escapeCsv(i.name),
            i.count ?? 0,
            i.valuePerUnit ?? 0,
            total.toFixed(2),
            escapeCsv(lastCheck),
          ].join(",")
        );
      }
      const totalValue = items.reduce(
        (s, i) => s + (i.count ?? 0) * (i.valuePerUnit ?? 0),
        0
      );
      rows.push("");
      rows.push(["TOTAL VALUE (₹)", "", "", totalValue.toFixed(2), ""].join(","));
      rows.push("");

      rows.push("Check History");
      rows.push(
        ["Stock Name", "Check Date", "Previous Count", "New Count", "Difference"].join(",")
      );
      for (const h of history) {
        const item = itemMap.get(h.stockId);
        const name = item?.name ?? h.stockId;
        const date = h.checkDate
          ? new Date(h.checkDate).toLocaleString("en-IN")
          : "";
        rows.push(
          [
            escapeCsv(name),
            escapeCsv(date),
            h.previousCount,
            h.newCount,
            h.difference >= 0 ? `+${h.difference}` : h.difference,
          ].join(",")
        );
      }
    }

    const csv = rows.join("\n");
    const bom = "\uFEFF";
    const filename = historyOnly
      ? `stock-history-${new Date().toISOString().split("T")[0]}.csv`
      : `stock-report-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Stock export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

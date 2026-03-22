import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import type { Entry } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search")?.trim();
    const format = searchParams.get("format") || "csv";

    const userId = await getUserId(request);
    const db = await getDb();
    const match: Record<string, unknown> = { businessId: userId };

    if (from || to) {
      match.date = {};
      if (from) (match.date as Record<string, string>).$gte = from;
      if (to) (match.date as Record<string, string>).$lte = to;
    }
    if (search) {
      const searchLower = search.toLowerCase();
      match.$or = [
        { nameLower: { $regex: searchLower, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
      ];
    }

    const entries = await db
      .collection<Entry>("entries")
      .find(match)
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    if (format === "csv") {
      const headers = ["Date", "Type", "Name", "Amount", "Method", "Bank", "Sender", "Note"];
      const rows = entries.map((e) => [
        e.date,
        e.type === "rotation_cash" ? "Wallet" : e.type.replace("_", " "),
        `"${(e.name || "").replace(/"/g, '""')}"`,
        e.amount,
        e.method,
        `"${((e.bankName ?? "").replace(/"/g, '""'))}"`,
        `"${((e.sender ?? "").replace(/"/g, '""'))}"`,
        `"${(e.note || "").replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const bom = "\uFEFF";
      return new NextResponse(bom + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="expenses-report-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    console.error("Error exporting entries:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}

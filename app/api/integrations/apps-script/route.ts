import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { SHEET_COLUMN_PATTERN, SHEET_COLUMNS } from "@/lib/userSettings";

export async function GET() {
  try {
    const scriptPath = join(process.cwd(), "scripts", "google-sheets-apps-script.gs");
    const source = readFileSync(scriptPath, "utf8");
    const versionMatch = source.match(/Version:\s*([^\n*]+)/);
    return NextResponse.json({
      source,
      version: versionMatch?.[1]?.trim() ?? null,
      sheetColumns: SHEET_COLUMN_PATTERN,
      sheetColumnList: SHEET_COLUMNS,
      setupSteps: [
        "Create a Google Sheet with Row 1 headers (exact order shown below).",
        "Open Extensions → Apps Script → paste the copied script → Save.",
        "Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).",
        "Copy the Web App URL and paste it in your account settings as Apps Script URL.",
      ],
    });
  } catch (error) {
    console.error("Apps Script template error:", error);
    return NextResponse.json({ error: "Failed to load Apps Script template" }, { status: 500 });
  }
}

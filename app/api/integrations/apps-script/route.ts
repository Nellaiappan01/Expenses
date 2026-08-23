import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { SHEET_COLUMN_PATTERN } from "@/lib/userSettings";

export async function GET() {
  try {
    const scriptPath = join(process.cwd(), "scripts", "google-sheets-apps-script.gs");
    const source = readFileSync(scriptPath, "utf8");
    return NextResponse.json({
      source,
      sheetColumns: SHEET_COLUMN_PATTERN,
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

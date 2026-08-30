import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { recalculateGoogleSheetBalances } from "@/lib/googleSheetsSync";
import { getSheetsWebhookUrl } from "@/lib/userSettings";
import { getUserId } from "@/lib/user";

export const maxDuration = 60;

/** Recalculate opening/closing balances on the linked Google Sheet. */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const webhookUrl = (await getSheetsWebhookUrl(db, userId)) ?? "";

    const result = await recalculateGoogleSheetBalances(webhookUrl);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Recalculate failed" },
        { status: result.timedOut ? 504 : 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Sheets] recalculate error:", error);
    return NextResponse.json({ error: "Recalculate failed" }, { status: 500 });
  }
}

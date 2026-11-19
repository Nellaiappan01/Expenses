import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createLedgerSheetTab, loadSheetPreview, parseOpeningAmount, setActiveSheetOpening, type OpeningMode } from "@/lib/sheetTabs";
import { getUserId, isUnauthorized } from "@/lib/user";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const result = await loadSheetPreview(db, userId);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, ...result.preview });
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    console.error("[Sheets] preview tab error:", error);
    return NextResponse.json({ ok: false, error: "Could not read the Google Sheet" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const body = (await request.json()) as {
      action?: unknown;
      sheetName?: unknown;
      mode?: unknown;
      customAmount?: unknown;
      expectedPreviousSheet?: unknown;
      confirmedOpening?: unknown;
    };
    if (body.action === "setOpening") {
      const amount = parseOpeningAmount(body.confirmedOpening);
      const result = await setActiveSheetOpening(db, userId, {
        amount: amount ?? Number.NaN,
        expectedSheet: typeof body.expectedPreviousSheet === "string" ? body.expectedPreviousSheet : "",
      });
      if (!result.ok) return NextResponse.json(result, { status: 409 });
      return NextResponse.json(result);
    }
    const mode = body.mode === "custom" ? "custom" : body.mode === "carry" ? "carry" : null;
    if (!mode) {
      return NextResponse.json({ ok: false, error: "Choose Auto Carry Forward or Custom Opening Balance" }, { status: 400 });
    }
    const result = await createLedgerSheetTab(db, userId, {
      sheetName: typeof body.sheetName === "string" ? body.sheetName : "",
      mode: mode as OpeningMode,
      customAmount: parseOpeningAmount(body.customAmount),
      expectedPreviousSheet: typeof body.expectedPreviousSheet === "string" ? body.expectedPreviousSheet : "",
      confirmedOpening: parseOpeningAmount(body.confirmedOpening),
    });
    if (!result.ok) return NextResponse.json(result, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    console.error("[Sheets] create tab error:", error);
    return NextResponse.json({ ok: false, error: "Could not create the sheet tab" }, { status: 500 });
  }
}

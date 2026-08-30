import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { getSheetsWebhookUrl } from "@/lib/userSettings";
import { probeAppsScriptDriveSupport } from "@/lib/googleDriveUpload";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const webhook = await getSheetsWebhookUrl(db, userId);
    if (!webhook) {
      return NextResponse.json({
        reachable: false,
        supportsDriveUpload: false,
        scriptVersion: null,
      });
    }

    const probe = await probeAppsScriptDriveSupport(webhook);
    return NextResponse.json(probe);
  } catch (error) {
    console.error("[Apps Script status]", error);
    return NextResponse.json({
      reachable: false,
      supportsDriveUpload: false,
      scriptVersion: null,
    });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { isCloudinaryConfigured, uploadUserBanner } from "@/lib/cloudinary";
import { getUserSettings, saveUserSettings, shortNameFromBusinessName } from "@/lib/userSettings";
import { normalizeGoogleDriveFolderUrl, parseGoogleDriveFolderId } from "@/lib/googleDriveFolder";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const settings = await getUserSettings(db, userId);
    return NextResponse.json({
      branding: settings.branding,
      integrations: settings.integrations,
    });
  } catch (error) {
    console.error("User settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const body = await request.json();

    const {
      appName,
      bannerUrl,
      bannerImageData,
      googleSheetUrl,
      appsScriptWebhookUrl,
      googleDriveFolderUrl,
    } = body as {
      appName?: string;
      bannerUrl?: string;
      bannerImageData?: string;
      googleSheetUrl?: string;
      appsScriptWebhookUrl?: string;
      googleDriveFolderUrl?: string;
    };

    const brandingPatch: {
      appName?: string;
      appShortName?: string;
      bannerUrl?: string;
    } = {};

    if (appName?.trim()) {
      brandingPatch.appName = appName.trim();
      brandingPatch.appShortName = shortNameFromBusinessName(appName);
    }

    if (bannerImageData?.trim()) {
      if (!isCloudinaryConfigured()) {
        return NextResponse.json(
          { error: "Cloudinary not configured. Cannot upload banner." },
          { status: 503 }
        );
      }
      const uploaded = await uploadUserBanner(userId, bannerImageData.trim());
      brandingPatch.bannerUrl = uploaded.url;
    } else if (bannerUrl?.trim()) {
      brandingPatch.bannerUrl = bannerUrl.trim();
    }

    const integrationsPatch: {
      googleSheetUrl?: string;
      appsScriptWebhookUrl?: string;
      googleDriveFolderUrl?: string;
    } = {};

    if (googleSheetUrl !== undefined) {
      integrationsPatch.googleSheetUrl = googleSheetUrl.trim();
    }
    if (appsScriptWebhookUrl !== undefined) {
      integrationsPatch.appsScriptWebhookUrl = appsScriptWebhookUrl.trim();
    }
    if (googleDriveFolderUrl !== undefined) {
      const trimmed = googleDriveFolderUrl.trim();
      if (trimmed && !parseGoogleDriveFolderId(trimmed)) {
        return NextResponse.json(
          { error: "Paste a Google Drive folder URL (drive.google.com/.../folders/...)." },
          { status: 400 }
        );
      }
      integrationsPatch.googleDriveFolderUrl = trimmed ? normalizeGoogleDriveFolderUrl(trimmed) : "";
    }

    const settings = await saveUserSettings(db, userId, {
      branding: Object.keys(brandingPatch).length ? brandingPatch : undefined,
      integrations: Object.keys(integrationsPatch).length ? integrationsPatch : undefined,
    });

    return NextResponse.json({
      branding: settings.branding,
      integrations: settings.integrations,
    });
  } catch (error) {
    console.error("User settings PATCH error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

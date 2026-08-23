import type { Db } from "mongodb";
import { APP_NAME, APP_SHORT_NAME, SALT_HEADER_BANNER_URL } from "./brandAssets";

export type UserBranding = {
  appName: string;
  appShortName: string;
  bannerUrl: string;
};

export type UserIntegrations = {
  googleSheetUrl: string;
  appsScriptWebhookUrl: string;
};

export type UserSettings = {
  branding: UserBranding;
  integrations: UserIntegrations;
};

export const SHEET_COLUMN_PATTERN =
  "Date | Opening Balance | Category | Expenses Amount | Notes | Add on | Source | Closing Balance | Requested by | Approved by";

export const DEFAULT_BRANDING: UserBranding = {
  appName: APP_NAME,
  appShortName: APP_SHORT_NAME,
  bannerUrl: SALT_HEADER_BANNER_URL,
};

export const DEFAULT_INTEGRATIONS: UserIntegrations = {
  googleSheetUrl: "",
  appsScriptWebhookUrl: "",
};

const HARIHARAN_IDS = new Set(["hariharan@gmail.com", "hariharan_gmail.com"]);

export function isHariharanAccount(userId: string, username?: string): boolean {
  const values = [userId, username].filter(Boolean).map((v) => v!.toLowerCase());
  return values.some((v) => HARIHARAN_IDS.has(v) || v.includes("hariharan@gmail.com"));
}

/** Env-based defaults for the Hariharan tenant (migration / first login). */
export function envDefaultSettings(): UserSettings {
  return {
    branding: {
      appName: APP_NAME,
      appShortName: APP_SHORT_NAME,
      bannerUrl: process.env.NEXT_PUBLIC_SALT_BANNER_URL?.trim() || SALT_HEADER_BANNER_URL,
    },
    integrations: {
      googleSheetUrl: process.env.GOOGLE_SHEETS_URL?.trim() || "",
      appsScriptWebhookUrl: process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim() || "",
    },
  };
}

function mergeBranding(stored?: Partial<UserBranding> | null): UserBranding {
  return {
    appName: stored?.appName?.trim() || DEFAULT_BRANDING.appName,
    appShortName: stored?.appShortName?.trim() || DEFAULT_BRANDING.appShortName,
    bannerUrl: stored?.bannerUrl?.trim() || DEFAULT_BRANDING.bannerUrl,
  };
}

function mergeIntegrations(stored?: Partial<UserIntegrations> | null): UserIntegrations {
  return {
    googleSheetUrl: stored?.googleSheetUrl?.trim() || "",
    appsScriptWebhookUrl: stored?.appsScriptWebhookUrl?.trim() || "",
  };
}

export async function getUserSettings(db: Db, businessId: string): Promise<UserSettings> {
  const doc = await db.collection("config").findOne({ businessId });
  const branding = mergeBranding(doc?.branding as Partial<UserBranding> | undefined);
  const integrations = mergeIntegrations(doc?.integrations as Partial<UserIntegrations> | undefined);
  return { branding, integrations };
}

export async function saveUserSettings(
  db: Db,
  businessId: string,
  patch: {
    branding?: Partial<UserBranding>;
    integrations?: Partial<UserIntegrations>;
  }
): Promise<UserSettings> {
  const current = await getUserSettings(db, businessId);
  const branding: UserBranding = {
    appName: patch.branding?.appName?.trim() || current.branding.appName,
    appShortName: patch.branding?.appShortName?.trim() || current.branding.appShortName,
    bannerUrl: patch.branding?.bannerUrl?.trim() || current.branding.bannerUrl,
  };
  const integrations: UserIntegrations = {
    googleSheetUrl:
      patch.integrations?.googleSheetUrl !== undefined
        ? patch.integrations.googleSheetUrl.trim()
        : current.integrations.googleSheetUrl,
    appsScriptWebhookUrl:
      patch.integrations?.appsScriptWebhookUrl !== undefined
        ? patch.integrations.appsScriptWebhookUrl.trim()
        : current.integrations.appsScriptWebhookUrl,
  };

  await db.collection("config").updateOne(
    { businessId },
    {
      $set: {
        branding,
        integrations,
        updatedAt: new Date(),
      },
      $setOnInsert: { businessId, createdAt: new Date() },
    },
    { upsert: true }
  );

  return { branding, integrations };
}

export async function ensureUserSettings(
  db: Db,
  businessId: string,
  username?: string
): Promise<UserSettings> {
  const doc = await db.collection("config").findOne({ businessId });
  const current = await getUserSettings(db, businessId);

  if (!isHariharanAccount(businessId, username)) {
    return current;
  }

  const env = envDefaultSettings();
  const storedBranding = doc?.branding as Partial<UserBranding> | undefined;
  const hasCustomAppName = Boolean(storedBranding?.appName?.trim());
  const hasCustomBanner = Boolean(
    storedBranding?.bannerUrl?.trim() &&
      storedBranding.bannerUrl.trim() !== DEFAULT_BRANDING.bannerUrl
  );

  const needsAppName = !hasCustomAppName;
  const needsBanner = !hasCustomBanner;
  const needsWebhook = !current.integrations.appsScriptWebhookUrl;
  const needsSheet = !current.integrations.googleSheetUrl;

  if (!needsAppName && !needsBanner && !needsWebhook && !needsSheet) {
    return current;
  }

  return saveUserSettings(db, businessId, {
    branding: {
      ...(needsAppName
        ? { appName: env.branding.appName, appShortName: env.branding.appShortName }
        : {}),
      ...(needsBanner ? { bannerUrl: env.branding.bannerUrl } : {}),
    },
    integrations: {
      ...(needsSheet && env.integrations.googleSheetUrl
        ? { googleSheetUrl: env.integrations.googleSheetUrl }
        : {}),
      ...(needsWebhook && env.integrations.appsScriptWebhookUrl
        ? { appsScriptWebhookUrl: env.integrations.appsScriptWebhookUrl }
        : {}),
    },
  });
}

export async function getSheetsWebhookUrl(db: Db, businessId: string): Promise<string | null> {
  const { integrations } = await getUserSettings(db, businessId);
  const userUrl = integrations.appsScriptWebhookUrl?.trim();
  if (userUrl) return userUrl;
  const envUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  return envUrl || null;
}

export function shortNameFromBusinessName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return APP_SHORT_NAME;
  const first = trimmed.split(/\s+/)[0];
  return first.length > 20 ? first.slice(0, 20) : first;
}

import { formatDriveDateFolderName } from "./dateFormat";
import { driveViewUrl } from "./googleDriveFolder";

const DRIVE_UPLOAD_TIMEOUT_MS = 45_000;

export type DriveUploadResult =
  | {
      ok: true;
      fileId: string;
      url: string;
      driveUrl: string;
      folderName: string;
    }
  | { ok: false; error: string };

function parseDataUrl(imageData: string): { mimeType: string; base64: string } | null {
  const match = imageData.trim().match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { mimeType: match[1], base64: match[2].replace(/\s+/g, "") };
}

function mimeToExt(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "jpg";
}

type DriveWebhookResponse = {
  ok?: boolean;
  error?: string;
  fileId?: string;
  url?: string;
  driveUrl?: string;
  folderName?: string;
};

export async function uploadExpenseAttachmentToDrive(params: {
  webhookUrl: string;
  folderId: string;
  isoDate: string;
  imageData: string;
}): Promise<DriveUploadResult> {
  const webhook = params.webhookUrl.trim();
  if (!webhook) {
    return { ok: false, error: "Apps Script webhook is required to save files in Google Drive" };
  }

  const parsed = parseDataUrl(params.imageData);
  if (!parsed) {
    return { ok: false, error: "Attachment file is not a valid image" };
  }

  const folderName = formatDriveDateFolderName(params.isoDate);
  if (!folderName) {
    return { ok: false, error: "Select a valid entry date before attaching a file" };
  }

  const fileName = `receipt-${params.isoDate}-${Date.now()}.${mimeToExt(parsed.mimeType)}`;

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "uploadAttachment",
        folderId: params.folderId,
        dateFolderName: folderName,
        fileName,
        mimeType: parsed.mimeType,
        fileBase64: parsed.base64,
      }),
      signal: AbortSignal.timeout(DRIVE_UPLOAD_TIMEOUT_MS),
    });

    const responseBody = await res.text().catch(() => "");
    let parsedJson: DriveWebhookResponse | null = null;
    if (responseBody.trim()) {
      try {
        parsedJson = JSON.parse(responseBody) as DriveWebhookResponse;
      } catch {
        parsedJson = null;
      }
    }

    if (!res.ok || parsedJson?.ok === false) {
      return {
        ok: false,
        error: parsedJson?.error || responseBody || `Drive upload failed (HTTP ${res.status})`,
      };
    }

    const fileId =
      parsedJson?.fileId?.trim() ||
      (typeof parsedJson?.url === "string"
        ? parsedJson.url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ?? ""
        : "");
    if (!fileId) {
      const body = responseBody.toLowerCase();
      if (body.includes("<html") || body.includes("<!doctype")) {
        return {
          ok: false,
          error:
            "Drive webhook opened a Google login page. In Settings → Apps Script use a /exec Web App URL with access Anyone.",
        };
      }
      if (parsedJson && ("row" in parsedJson || parsedJson.ok === true)) {
        return {
          ok: false,
          error:
            "This Web App is an old script. Settings → Apps Script → Copy script → paste → Deploy → New deployment, then save the new URL.",
        };
      }
      return {
        ok: false,
        error:
          "Drive upload needs a new Apps Script deployment. Settings → Apps Script → Copy script → New deployment.",
      };
    }

    return {
      ok: true,
      fileId,
      url: parsedJson?.url?.trim() || driveViewUrl(fileId),
      driveUrl: parsedJson?.driveUrl?.trim() || `https://drive.google.com/file/d/${fileId}/view`,
      folderName: parsedJson?.folderName?.trim() || folderName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive upload failed";
    return { ok: false, error: message };
  }
}

export async function probeAppsScriptDriveSupport(webhookUrl: string): Promise<{
  reachable: boolean;
  supportsDriveUpload: boolean;
  scriptVersion: string | null;
}> {
  const webhook = webhookUrl.trim();
  if (!webhook) {
    return { reachable: false, supportsDriveUpload: false, scriptVersion: null };
  }

  try {
    const res = await fetch(webhook, {
      method: "GET",
      signal: AbortSignal.timeout(12_000),
    });
    const body = await res.text().catch(() => "");
    let parsed: { supportsDriveUpload?: boolean; scriptVersion?: string } | null = null;
    try {
      parsed = JSON.parse(body) as { supportsDriveUpload?: boolean; scriptVersion?: string };
    } catch {
      parsed = null;
    }
    return {
      reachable: Boolean(parsed?.scriptVersion || parsed?.supportsDriveUpload || parsed),
      supportsDriveUpload: Boolean(parsed?.supportsDriveUpload),
      scriptVersion: parsed?.scriptVersion?.trim() || null,
    };
  } catch {
    return { reachable: false, supportsDriveUpload: false, scriptVersion: null };
  }
}

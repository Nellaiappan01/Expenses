import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/user";
import { getDb } from "@/lib/mongodb";
import {
  isCloudinaryConfigured,
  uploadExpenseAttachment,
  uploadFromRemoteUrl,
} from "@/lib/cloudinary";
import { getGoogleDriveFolderUrl, getSheetsWebhookUrl } from "@/lib/userSettings";
import { parseGoogleDriveFolderId } from "@/lib/googleDriveFolder";
import { uploadExpenseAttachmentToDrive } from "@/lib/googleDriveUpload";
import { toDateInputValue } from "@/lib/dateFormat";

async function readUploadBody(request: NextRequest): Promise<{
  imageData?: string;
  remoteUrl?: string;
  date?: string;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const date = String(form.get("date") || "");
    const remoteUrl = String(form.get("remoteUrl") || "").trim();
    const file = form.get("file");
    let imageData: string | undefined;
    if (file && typeof file !== "string" && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/jpeg";
      imageData = `data:${mime};base64,${buf.toString("base64")}`;
    } else {
      const raw = String(form.get("imageData") || "").trim();
      imageData = raw || undefined;
    }
    return { imageData, remoteUrl: remoteUrl || undefined, date };
  }

  const body = (await request.json()) as {
    imageData?: string;
    remoteUrl?: string;
    date?: string;
  };
  return body;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { imageData, remoteUrl, date } = await readUploadBody(request);

    const isoDate = date ? toDateInputValue(date) : "";
    const trimmedImage = imageData?.trim() || "";
    const trimmedRemote = remoteUrl?.trim() || "";

    const db = await getDb();
    const driveFolderUrl = await getGoogleDriveFolderUrl(db, userId);
    const folderId = driveFolderUrl ? parseGoogleDriveFolderId(driveFolderUrl) : null;

    const cloudinaryTask = async (): Promise<{ url: string; publicId: string } | null> => {
      if (!isCloudinaryConfigured()) return null;
      if (trimmedRemote) return uploadFromRemoteUrl(userId, trimmedRemote);
      if (trimmedImage) return uploadExpenseAttachment(userId, trimmedImage);
      return null;
    };

    const driveTask = async () => {
      if (!folderId || !trimmedImage) return null;
      const webhook = await getSheetsWebhookUrl(db, userId);
      return uploadExpenseAttachmentToDrive({
        webhookUrl: webhook || "",
        folderId,
        isoDate: isoDate || toDateInputValue(new Date()),
        imageData: trimmedImage,
      });
    };

    if (!trimmedImage && !trimmedRemote) {
      return NextResponse.json({ error: "imageData or remoteUrl is required" }, { status: 400 });
    }

    const [cloudinary, driveResult] = await Promise.all([cloudinaryTask(), driveTask()]);

    let driveError: string | undefined;
    let drive:
      | { fileId: string; url: string; driveUrl: string; folderName: string }
      | undefined;

    if (driveResult?.ok) {
      drive = {
        fileId: driveResult.fileId,
        url: driveResult.url,
        driveUrl: driveResult.driveUrl,
        folderName: driveResult.folderName,
      };
    } else if (driveResult && !driveResult.ok) {
      driveError = driveResult.error;
    }

    if (!cloudinary && !drive) {
      if (!isCloudinaryConfigured() && !folderId) {
        return NextResponse.json(
          { error: "Add a Google Drive folder URL in Defaults, or configure Cloudinary." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: driveError || "Failed to upload attachment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: cloudinary?.url || drive?.url,
      publicId: cloudinary?.publicId || (drive ? `drive:${drive.fileId}` : undefined),
      driveUrl: drive?.driveUrl,
      driveFileId: drive?.fileId,
      driveFolderName: drive?.folderName,
      driveError,
    });
  } catch (error) {
    console.error("[Attachment upload]", error);
    return NextResponse.json({ error: "Failed to upload attachment" }, { status: 500 });
  }
}

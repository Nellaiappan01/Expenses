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

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const { imageData, remoteUrl, date } = body as {
      imageData?: string;
      remoteUrl?: string;
      date?: string;
    };

    const isoDate = date ? toDateInputValue(date) : "";

    let cloudinary: { url: string; publicId: string } | null = null;
    if (isCloudinaryConfigured()) {
      if (remoteUrl?.trim()) {
        cloudinary = await uploadFromRemoteUrl(userId, remoteUrl.trim());
      } else if (imageData?.trim()) {
        cloudinary = await uploadExpenseAttachment(userId, imageData);
      }
    }

    if (!cloudinary && !imageData?.trim() && !remoteUrl?.trim()) {
      return NextResponse.json({ error: "imageData or remoteUrl is required" }, { status: 400 });
    }

    const db = await getDb();
    const driveFolderUrl = await getGoogleDriveFolderUrl(db, userId);
    const folderId = driveFolderUrl ? parseGoogleDriveFolderId(driveFolderUrl) : null;
    let driveError: string | undefined;
    let drive:
      | { fileId: string; url: string; driveUrl: string; folderName: string }
      | undefined;

    if (folderId && imageData?.trim()) {
      const webhook = await getSheetsWebhookUrl(db, userId);
      const uploaded = await uploadExpenseAttachmentToDrive({
        webhookUrl: webhook || "",
        folderId,
        isoDate: isoDate || toDateInputValue(new Date()),
        imageData: imageData.trim(),
      });
      if (uploaded.ok) {
        drive = {
          fileId: uploaded.fileId,
          url: uploaded.url,
          driveUrl: uploaded.driveUrl,
          folderName: uploaded.folderName,
        };
      } else {
        driveError = uploaded.error;
      }
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

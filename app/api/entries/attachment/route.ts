import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/user";
import {
  isCloudinaryConfigured,
  uploadExpenseAttachment,
  uploadFromRemoteUrl,
} from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  try {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Cloudinary not configured. Add CLOUDINARY_* to .env.local" },
        { status: 503 }
      );
    }

    const userId = await getUserId(request);
    const body = await request.json();
    const { imageData, remoteUrl } = body as {
      imageData?: string;
      remoteUrl?: string;
    };

    if (remoteUrl?.trim()) {
      const result = await uploadFromRemoteUrl(userId, remoteUrl.trim());
      return NextResponse.json(result);
    }

    if (!imageData?.trim()) {
      return NextResponse.json({ error: "imageData or remoteUrl is required" }, { status: 400 });
    }

    const result = await uploadExpenseAttachment(userId, imageData);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Attachment upload]", error);
    return NextResponse.json({ error: "Failed to upload attachment" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/user";
import {
  isCloudinaryConfigured,
  uploadFromRemoteUrl,
} from "@/lib/cloudinary";

/** Download a Google Photos item (baseUrl) and store on Cloudinary. */
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
    const { baseUrl, mimeType } = body as { baseUrl?: string; mimeType?: string };

    if (!baseUrl?.trim()) {
      return NextResponse.json({ error: "baseUrl is required" }, { status: 400 });
    }

    const downloadUrl = baseUrl.includes("=d") ? baseUrl : `${baseUrl}=d`;
    const headers: Record<string, string> = {};
    if (mimeType) headers.Accept = mimeType;

    const imageRes = await fetch(downloadUrl, { headers });
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: `Could not download Google Photo (HTTP ${imageRes.status})` },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get("content-type") ?? mimeType ?? "image/jpeg";
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

    const result = await uploadFromRemoteUrl(userId, dataUrl);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Google Photos import]", error);
    return NextResponse.json({ error: "Failed to import Google Photo" }, { status: 500 });
  }
}

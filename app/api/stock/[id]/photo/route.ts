import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import {
  deleteStockImage,
  isCloudinaryConfigured,
  uploadStockImage,
} from "@/lib/cloudinary";
import { stockThumbUrl } from "@/lib/cloudinaryUrls";
import { deleteStockPhoto, readStockPhoto } from "@/lib/stockPhoto";

const MAX_BYTES = 5 * 1024 * 1024;

async function getOwnedStock(userId: string, id: string) {
  if (!id || !ObjectId.isValid(id)) return null;
  const db = await getDb();
  return db.collection("stock").findOne({
    _id: new ObjectId(id),
    businessId: userId,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(request);
    const item = await getOwnedStock(userId, id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.photoUrl) {
      return NextResponse.redirect(item.photoUrl as string);
    }

    const buffer = await readStockPhoto(userId, id);
    if (!buffer) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Stock photo GET error:", error);
    return NextResponse.json({ error: "Failed to load photo" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Cloudinary not configured. Add CLOUDINARY_* to .env.local" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const userId = await getUserId(request);
    const item = await getOwnedStock(userId, id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";
    let imageInput: string | Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("photo");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: "Photo file required" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > MAX_BYTES) {
        return NextResponse.json({ error: "Image too large (max 5 MB)" }, { status: 400 });
      }
      imageInput = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } else {
      const body = await request.json();
      const dataUrl = body.photo as string | undefined;
      if (!dataUrl?.startsWith("data:image/")) {
        return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
      }
      const base64 = dataUrl.split(",")[1];
      if (!base64 || Buffer.from(base64, "base64").length > MAX_BYTES) {
        return NextResponse.json({ error: "Image too large (max 5 MB)" }, { status: 400 });
      }
      imageInput = dataUrl;
    }

    if (item.photoPublicId) {
      await deleteStockImage(item.photoPublicId as string);
    }

    const { url, publicId } = await uploadStockImage(userId, id, imageInput);
    await deleteStockPhoto(userId, id);

    const db = await getDb();
    await db.collection("stock").updateOne(
      { _id: new ObjectId(id), businessId: userId },
      {
        $set: {
          hasPhoto: true,
          photoUrl: url,
          photoPublicId: publicId,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      ok: true,
      hasPhoto: true,
      photoUrl: url,
      photoThumbUrl: stockThumbUrl(url),
    });
  } catch (error) {
    console.error("Stock photo POST error:", error);
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(request);
    const item = await getOwnedStock(userId, id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.photoPublicId) {
      await deleteStockImage(item.photoPublicId as string);
    }
    await deleteStockPhoto(userId, id);

    const db = await getDb();
    await db.collection("stock").updateOne(
      { _id: new ObjectId(id), businessId: userId },
      {
        $set: { hasPhoto: false, updatedAt: new Date() },
        $unset: { photoUrl: "", photoPublicId: "" },
      }
    );

    return NextResponse.json({ ok: true, hasPhoto: false, photoUrl: null });
  } catch (error) {
    console.error("Stock photo DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}

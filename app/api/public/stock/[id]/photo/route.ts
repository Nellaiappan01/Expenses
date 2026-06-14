import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { PublicStockUserNotFoundError, resolvePublicBusinessId } from "@/lib/publicStock";
import { readStockPhoto } from "@/lib/stockPhoto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const userSlug = request.nextUrl.searchParams.get("user");
    const businessId = await resolvePublicBusinessId(userSlug);
    const db = await getDb();
    const item = await db.collection("stock").findOne({
      _id: new ObjectId(id),
      businessId,
    });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.photoUrl) {
      return NextResponse.redirect(item.photoUrl as string);
    }

    const buffer = await readStockPhoto(businessId, id);
    if (!buffer) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof PublicStockUserNotFoundError) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    console.error("Public stock photo GET error:", error);
    return NextResponse.json({ error: "Failed to load photo" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { fetchPublicStockPayload, PublicStockUserNotFoundError } from "@/lib/publicStock";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await fetchPublicStockPayload({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      details: searchParams.get("details") === "1",
      user: searchParams.get("user"),
    });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    if (error instanceof PublicStockUserNotFoundError) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    console.error("Public stock GET error:", error);
    return NextResponse.json({ error: "Failed to load stock" }, { status: 500 });
  }
}

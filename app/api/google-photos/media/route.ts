import { NextRequest, NextResponse } from "next/server";

/** List media items selected in a completed Google Photos Picker session. */
export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!accessToken || !sessionId) {
    return NextResponse.json({ error: "sessionId and access token required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Failed to list media items" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Google Photos media]", error);
    return NextResponse.json({ error: "Failed to list media items" }, { status: 500 });
  }
}

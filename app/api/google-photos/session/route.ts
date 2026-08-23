import { NextRequest, NextResponse } from "next/server";

const PICKER_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

/** Create a Google Photos Picker session (requires client OAuth access token). */
export async function POST(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  try {
    const res = await fetch("https://photospicker.googleapis.com/v1/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pickingConfig: { maxItemCount: 1 } }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Failed to create picker session" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      sessionId: data.id,
      pickerUri: data.pickerUri,
      scope: PICKER_SCOPE,
    });
  } catch (error) {
    console.error("[Google Photos session]", error);
    return NextResponse.json({ error: "Failed to create picker session" }, { status: 500 });
  }
}

/** Poll picker session status. */
export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!accessToken || !sessionId) {
    return NextResponse.json({ error: "sessionId and access token required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Failed to read session" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Google Photos session poll]", error);
    return NextResponse.json({ error: "Failed to poll session" }, { status: 500 });
  }
}

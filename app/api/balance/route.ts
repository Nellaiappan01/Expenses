import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { computeNetBalance } from "@/lib/balance";
import { getUserId } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const net = await computeNetBalance(db, userId);
    return NextResponse.json(
      { net },
      {
        headers: {
          "Cache-Control": "private, max-age=5",
        },
      }
    );
  } catch (error) {
    console.error("Balance GET error:", error);
    return NextResponse.json({ net: 0 }, { status: 503 });
  }
}

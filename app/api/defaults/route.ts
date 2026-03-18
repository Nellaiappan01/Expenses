import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export interface DefaultsDoc {
  businessId: string;
  names: string[];
  notes: string[];
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const db = await getDb();
    const doc = await db.collection<DefaultsDoc>("defaults").findOne({
      businessId: userId,
    });

    return NextResponse.json({
      names: doc?.names ?? [],
      notes: doc?.notes ?? [],
    });
  } catch (error) {
    console.error("Error fetching defaults:", error);
    return NextResponse.json({ names: [], notes: [] });
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { names, notes } = body;

    const userId = getUserId(request);
    const db = await getDb();
    await db.collection("defaults").updateOne(
      { businessId: userId },
      {
        $set: {
          businessId: userId,
          names: Array.isArray(names) ? names : [],
          notes: Array.isArray(notes) ? notes : [],
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving defaults:", error);
    return NextResponse.json(
      { error: "Database unavailable. Check MONGODB_URI in .env.local" },
      { status: 503 }
    );
  }
}

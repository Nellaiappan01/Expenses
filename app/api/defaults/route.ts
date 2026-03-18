import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export interface DefaultsDoc {
  businessId: string;
  names?: string[];
  expenseNames?: string[];
  workerNames?: string[];
  notes: string[];
  banks: string[];
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const doc = await db.collection<DefaultsDoc>("defaults").findOne({
      businessId: userId,
    });

    const legacyNames = doc?.names ?? [];
    return NextResponse.json({
      expenseNames: doc?.expenseNames ?? legacyNames,
      workerNames: doc?.workerNames ?? [],
      notes: doc?.notes ?? [],
      banks: doc?.banks ?? [],
    });
  } catch (error) {
    console.error("Error fetching defaults:", error);
    return NextResponse.json({ expenseNames: [], workerNames: [], notes: [], banks: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expenseNames, workerNames, notes, banks } = body;

    const userId = await getUserId(request);
    const db = await getDb();
    await db.collection("defaults").updateOne(
      { businessId: userId },
      {
        $set: {
          businessId: userId,
          expenseNames: Array.isArray(expenseNames) ? expenseNames : [],
          workerNames: Array.isArray(workerNames) ? workerNames : [],
          notes: Array.isArray(notes) ? notes : [],
          banks: Array.isArray(banks) ? banks : [],
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

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import {
  mergeCategories,
  mergeExpenseCategories,
  mergeExpenseTags,
} from "@/lib/entryCategories";

export interface DefaultsDoc {
  businessId: string;
  names?: string[];
  expenseNames?: string[];
  workerNames?: string[];
  approverNames?: string[];
  workerCategories?: string[];
  expenseCategories?: string[];
  expenseTags?: string[];
  notes?: string[];
  banks?: string[];
  updatedAt?: Date;
}

function starterDefaults() {
  return {
    expenseNames: [] as string[],
    workerNames: [] as string[],
    approverNames: [] as string[],
    workerCategories: mergeCategories([]),
    expenseCategories: mergeExpenseCategories([]),
    expenseTags: mergeExpenseTags([]),
    notes: [] as string[],
    banks: [] as string[],
  };
}

function rawFromDoc(doc: DefaultsDoc) {
  const legacyNames = doc.names ?? [];
  return {
    expenseNames: doc.expenseNames ?? legacyNames,
    workerNames: doc.workerNames ?? [],
    approverNames: doc.approverNames ?? [],
    workerCategories: doc.workerCategories ?? [],
    expenseCategories: doc.expenseCategories ?? [],
    expenseTags: doc.expenseTags ?? [],
    notes: doc.notes ?? [],
    banks: doc.banks ?? [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const doc = await db.collection<DefaultsDoc>("defaults").findOne({
      businessId: userId,
    });

    if (!doc) {
      return NextResponse.json(starterDefaults());
    }

    return NextResponse.json(rawFromDoc(doc));
  } catch (error) {
    console.error("Error fetching defaults:", error);
    return NextResponse.json(starterDefaults());
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      expenseNames,
      workerNames,
      approverNames,
      workerCategories,
      expenseCategories,
      expenseTags,
      notes,
      banks,
    } = body;

    const userId = await getUserId(request);
    const db = await getDb();

    const payload = {
      businessId: userId,
      expenseNames: Array.isArray(expenseNames) ? expenseNames : [],
      workerNames: Array.isArray(workerNames) ? workerNames : [],
      approverNames: Array.isArray(approverNames) ? approverNames : [],
      workerCategories: Array.isArray(workerCategories) ? workerCategories : [],
      expenseCategories: Array.isArray(expenseCategories) ? expenseCategories : [],
      expenseTags: Array.isArray(expenseTags) ? expenseTags : [],
      notes: Array.isArray(notes) ? notes : [],
      banks: Array.isArray(banks) ? banks : [],
      updatedAt: new Date(),
    };

    await db.collection("defaults").updateOne(
      { businessId: userId },
      {
        $set: payload,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error("Error saving defaults:", error);
    return NextResponse.json(
      { error: "Database unavailable. Check MONGODB_URI in .env.local" },
      { status: 503 }
    );
  }
}

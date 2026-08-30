import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import {
  mergeCategories,
  mergeExpenseCategories,
  mergeExpenseTags,
} from "@/lib/entryCategories";
import {
  expenseNamesFromPeople,
  normalizeExpensePeople,
  sanitizeExpensePerson,
} from "@/lib/expensePeople";
import { sanitizeProfitabilityCategoryRules } from "@/lib/profitability";
import { normalizeExpenseNotes, type ExpenseNoteDefault } from "@/lib/expenseNotes";
import type { ExpensePerson } from "@/lib/types";

export interface DefaultsDoc {
  businessId: string;
  names?: string[];
  expenseNames?: string[];
  expensePeople?: ExpensePerson[];
  workerNames?: string[];
  approverNames?: string[];
  workerCategories?: string[];
  expenseCategories?: string[];
  expenseTags?: string[];
  notes?: string[] | ExpenseNoteDefault[];
  banks?: string[];
  profitabilityCategoryRules?: Record<string, string>;
  updatedAt?: Date;
}

function starterDefaults() {
  return {
    expenseNames: [] as string[],
    expensePeople: [] as ExpensePerson[],
    workerNames: [] as string[],
    approverNames: [] as string[],
    workerCategories: mergeCategories([]),
    expenseCategories: mergeExpenseCategories([]),
    expenseTags: mergeExpenseTags([]),
    notes: [] as ExpenseNoteDefault[],
    banks: [] as string[],
  };
}

function rawFromDoc(doc: DefaultsDoc) {
  const expensePeople = normalizeExpensePeople(doc);
  return {
    expenseNames: expenseNamesFromPeople(expensePeople),
    expensePeople,
    workerNames: doc.workerNames ?? [],
    approverNames: doc.approverNames ?? [],
    workerCategories: doc.workerCategories ?? [],
    expenseCategories: doc.expenseCategories ?? [],
    expenseTags: doc.expenseTags ?? [],
    notes: normalizeExpenseNotes(doc.notes),
    banks: doc.banks ?? [],
    profitabilityCategoryRules: sanitizeProfitabilityCategoryRules(
      doc.profitabilityCategoryRules
    ),
  };
}

function parseExpensePeople(raw: unknown): ExpensePerson[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const people: ExpensePerson[] = [];
  for (const item of raw) {
    const person = sanitizeExpensePerson(item as Partial<ExpensePerson>);
    if (!person || seen.has(person.nameLower)) continue;
    seen.add(person.nameLower);
    people.push(person);
  }
  return people;
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
      expensePeople: rawExpensePeople,
      expenseNames,
      workerNames,
      approverNames,
      workerCategories,
      expenseCategories,
      expenseTags,
      notes,
      banks,
      profitabilityCategoryRules: rawCategoryRules,
    } = body;

    const userId = await getUserId(request);
    const db = await getDb();

    const expensePeople =
      Array.isArray(rawExpensePeople) && rawExpensePeople.length > 0
        ? parseExpensePeople(rawExpensePeople)
        : normalizeExpensePeople({
            expenseNames: Array.isArray(expenseNames) ? expenseNames : [],
          });

    const payload = {
      businessId: userId,
      expensePeople,
      expenseNames: expenseNamesFromPeople(expensePeople),
      workerNames: Array.isArray(workerNames) ? workerNames : [],
      approverNames: Array.isArray(approverNames) ? approverNames : [],
      workerCategories: Array.isArray(workerCategories) ? workerCategories : [],
      expenseCategories: Array.isArray(expenseCategories) ? expenseCategories : [],
      expenseTags: Array.isArray(expenseTags) ? expenseTags : [],
      notes: normalizeExpenseNotes(notes),
      banks: Array.isArray(banks) ? banks : [],
      profitabilityCategoryRules: sanitizeProfitabilityCategoryRules(
        rawCategoryRules
      ),
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

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import type { Entry, EntryInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: EntryInput = await request.json();
    const { name, amount, method, date, note, bankName, sender, type = "expense" } = body;

    if (!name || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Name and amount are required" },
        { status: 400 }
      );
    }

    const userId = await getUserId(request);
    const entry: Omit<Entry, "_id"> = {
      type,
      name: name.trim(),
      nameLower: name.trim().toLowerCase(),
      amount: Number(amount),
      method: method || "Cash",
      date: date || new Date().toISOString().split("T")[0],
      note: note?.trim() || undefined,
      bankName: bankName?.trim() || undefined,
      sender: sender?.trim() || undefined,
      businessId: userId,
      createdAt: new Date(),
    };

    const db = await getDb();
    const result = await db.collection("entries").insertOne(entry);

    return NextResponse.json({
      ...entry,
      _id: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("Error creating entry:", error);
    return NextResponse.json(
      { error: "Database unavailable. Check MONGODB_URI in .env.local" },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const entries = await db
      .collection<Entry>("entries")
      .find({ businessId: userId })
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    const serialized = entries.map((e) => ({
      ...e,
      _id: e._id?.toString(),
      createdAt: e.createdAt?.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching entries:", error);
    return NextResponse.json([]);
  }
}

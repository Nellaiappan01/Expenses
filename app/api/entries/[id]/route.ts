import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import type { Entry, EntryInput } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const body: Partial<EntryInput> = await request.json();
    const { name, amount, method, date, note, bankName, sender, type } = body;

    const userId = getUserId(request);
    const db = await getDb();
    const collection = db.collection("entries");

    const existing = await collection.findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) {
      update.name = name.trim();
      update.nameLower = name.trim().toLowerCase();
    }
    if (amount !== undefined) update.amount = Number(amount);
    if (method !== undefined) update.method = method;
    if (date !== undefined) update.date = date;
    if (note !== undefined) update.note = note?.trim() || undefined;
    if (bankName !== undefined) update.bankName = bankName?.trim() || undefined;
    if (sender !== undefined) update.sender = sender?.trim() || undefined;
    if (type !== undefined) update.type = type;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), businessId: userId },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      ...result,
      _id: result._id?.toString(),
      createdAt: result.createdAt?.toISOString?.(),
    });
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const userId = getUserId(request);
    const db = await getDb();
    const result = await db.collection("entries").deleteOne({
      _id: new ObjectId(id),
      businessId: userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting entry:", error);
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 }
    );
  }
}

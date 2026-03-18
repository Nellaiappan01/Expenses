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

    const userId = await getUserId(request);
    const db = await getDb();
    const collection = db.collection("entries");

    const existing = await collection.findOne({
      _id: new ObjectId(id),
      businessId: userId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const setUpdate: Record<string, unknown> = {};
    const unsetUpdate: Record<string, string> = {};
    if (name !== undefined) {
      setUpdate.name = name.trim();
      setUpdate.nameLower = name.trim().toLowerCase();
    }
    if (amount !== undefined) setUpdate.amount = Number(amount);
    if (method !== undefined) setUpdate.method = method;
    if (date !== undefined) setUpdate.date = date;
    if (note !== undefined) {
      const v = note?.trim();
      if (v) setUpdate.note = v;
      else unsetUpdate.note = "";
    }
    if (bankName !== undefined) {
      const v = bankName?.trim();
      if (v) setUpdate.bankName = v;
      else unsetUpdate.bankName = "";
    }
    if (sender !== undefined) {
      const v = sender?.trim();
      if (v) setUpdate.sender = v;
      else unsetUpdate.sender = "";
    }
    if (type !== undefined) setUpdate.type = type;

    const updateOp: Record<string, unknown> = {};
    if (Object.keys(setUpdate).length) updateOp.$set = setUpdate;
    if (Object.keys(unsetUpdate).length) updateOp.$unset = unsetUpdate;

    if (Object.keys(updateOp).length === 0) {
      return NextResponse.json({
        ...existing,
        _id: existing._id?.toString(),
        createdAt: existing.createdAt?.toISOString?.(),
      });
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), businessId: userId },
      updateOp,
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

    const userId = await getUserId(request);
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

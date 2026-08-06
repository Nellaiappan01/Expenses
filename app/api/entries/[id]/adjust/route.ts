import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import {
  buildUpdateAuditChanges,
  NOT_DELETED_MATCH,
  recordEntryAuditLogs,
} from "@/lib/entryAudit";
import type { EntryInput, PaymentMethod } from "@/lib/types";

type AdjustBody = Partial<EntryInput> & {
  reason: string;
  editedBy: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const body: AdjustBody = await request.json();
    const { reason, editedBy, name, amount, method, date, category, note, bankName } = body;

    if (!reason?.trim()) {
      return NextResponse.json({ error: "Reason is required for adjustments" }, { status: 400 });
    }
    if (!editedBy?.trim()) {
      return NextResponse.json({ error: "Edited by is required" }, { status: 400 });
    }

    const userId = await getUserId(request);
    const db = await getDb();
    const collection = db.collection("entries");

    const existing = await collection.findOne({
      _id: new ObjectId(id),
      businessId: userId,
      ...NOT_DELETED_MATCH,
    });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const setUpdate: Record<string, unknown> = {};
    const unsetUpdate: Record<string, string> = {};
    const auditInput: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Worker name is required" }, { status: 400 });
      }
      setUpdate.name = trimmed;
      setUpdate.nameLower = trimmed.toLowerCase();
      auditInput.name = trimmed;
    }
    if (amount !== undefined) {
      const num = Number(amount);
      if (Number.isNaN(num) || num === 0) {
        return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
      }
      setUpdate.amount = num;
      auditInput.amount = num;
    }
    if (method !== undefined) {
      setUpdate.method = method;
      auditInput.method = method;
    }
    if (date !== undefined) {
      setUpdate.date = date;
      auditInput.date = date;
    }
    if (category !== undefined) {
      const trimmed = category.trim();
      if (trimmed) setUpdate.category = trimmed;
      else unsetUpdate.category = "";
      auditInput.category = trimmed || null;
    }
    if (note !== undefined) {
      const trimmed = note.trim();
      if (trimmed) setUpdate.note = trimmed;
      else unsetUpdate.note = "";
      auditInput.note = trimmed || null;
    }
    if (bankName !== undefined) {
      const trimmed = bankName.trim();
      if (trimmed) setUpdate.bankName = trimmed;
      else unsetUpdate.bankName = "";
      auditInput.bankName = trimmed || null;
    }

    const changes = buildUpdateAuditChanges(existing as Record<string, unknown>, auditInput);
    if (changes.length === 0) {
      return NextResponse.json({
        ...existing,
        _id: existing._id?.toString(),
        createdAt: existing.createdAt?.toISOString?.(),
      });
    }

    const updateOp: Record<string, unknown> = {
      $set: { ...setUpdate, isEdited: true, editedAt: new Date(), editedBy: editedBy.trim() },
    };
    if (Object.keys(unsetUpdate).length) updateOp.$unset = unsetUpdate;

    await recordEntryAuditLogs(db, {
      entryId: id,
      businessId: userId,
      action: "update",
      changes,
      editedBy: editedBy.trim(),
      reason: reason.trim(),
    });

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), businessId: userId, ...NOT_DELETED_MATCH },
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
    console.error("Error adjusting entry:", error);
    return NextResponse.json({ error: "Failed to adjust entry" }, { status: 500 });
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

    let reason = "";
    let editedBy = "";
    try {
      const body = await request.json();
      reason = body.reason?.trim() ?? "";
      editedBy = body.editedBy?.trim() ?? "";
    } catch {
      /* empty body */
    }

    if (!reason) {
      return NextResponse.json({ error: "Reason is required for deletion" }, { status: 400 });
    }
    if (!editedBy) {
      return NextResponse.json({ error: "Edited by is required" }, { status: 400 });
    }

    const userId = await getUserId(request);
    const db = await getDb();
    const collection = db.collection("entries");

    const existing = await collection.findOne({
      _id: new ObjectId(id),
      businessId: userId,
      ...NOT_DELETED_MATCH,
    });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const snapshot = {
      type: existing.type,
      name: existing.name,
      amount: existing.amount,
      method: existing.method as PaymentMethod,
      date: existing.date,
      category: existing.category ?? null,
      note: existing.note ?? null,
    };

    await recordEntryAuditLogs(db, {
      entryId: id,
      businessId: userId,
      action: "delete",
      changes: [{ field: "entry", originalValue: snapshot, newValue: null }],
      editedBy,
      reason,
    });

    const deletedAt = new Date();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), businessId: userId, ...NOT_DELETED_MATCH },
      {
        $set: {
          deleted: true,
          deletedAt,
          deletedBy: editedBy,
          isEdited: true,
          editedAt: deletedAt,
          editedBy,
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({
      ...result,
      _id: result._id?.toString(),
      createdAt: result.createdAt?.toISOString?.(),
    });
  } catch (error) {
    console.error("Error deleting entry:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}

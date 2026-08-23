import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { invalidateBalanceCache } from "@/lib/balance";
import { normalizeStoredAmount } from "@/lib/entryAmount";
import {
  buildUpdateAuditChanges,
  NOT_DELETED_MATCH,
  recordEntryAuditLogs,
} from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { ensureApproverName, ensureExpenseCategory, ensureExpenseName } from "@/lib/expenseDefaultsHelpers";
import { scheduleSheetsAdjustment } from "@/lib/googleSheetsSync";
import { getDb } from "@/lib/mongodb";
import type { Entry, EntryType } from "@/lib/types";

type AdminEntryBody = {
  reason?: string;
  name?: string;
  amount?: number;
  date?: string;
  category?: string;
  note?: string;
  approvedBy?: string;
  paymentDueDate?: string;
};

function adminLabel(user: Record<string, unknown>) {
  const name = typeof user.name === "string" ? user.name : "";
  const username = typeof user.username === "string" ? user.username : "";
  const userId = typeof user.userId === "string" ? user.userId : "";
  return name || username || userId || "Admin";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const body: AdminEntryBody = await request.json();
    const {
      reason,
      name,
      amount,
      date,
      category,
      note,
      approvedBy,
      paymentDueDate,
    } = body;

    if (!reason?.trim()) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }

    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const collection = db.collection("entries");
    const existing = await collection.findOne({
      _id: new ObjectId(id),
      ...NOT_DELETED_MATCH,
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (existing.type !== "expense") {
      return NextResponse.json({ error: "Only expense entries can be edited here" }, { status: 400 });
    }

    const businessId = existing.businessId as string;
    const setUpdate: Record<string, unknown> = {};
    const unsetUpdate: Record<string, string> = {};
    const auditInput: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Requested by is required" }, { status: 400 });
      }
      await ensureExpenseName(db, businessId, trimmed);
      setUpdate.name = trimmed;
      setUpdate.nameLower = trimmed.toLowerCase();
      auditInput.name = trimmed;
    }

    if (amount !== undefined) {
      const num = Number(amount);
      if (Number.isNaN(num) || num <= 0) {
        return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
      }
      const entryType = existing.type as EntryType;
      setUpdate.amount = normalizeStoredAmount(entryType, num);
      auditInput.amount = setUpdate.amount;
    }

    if (date !== undefined) {
      setUpdate.date = date;
      auditInput.date = date;
    }

    if (category !== undefined) {
      const trimmed = category.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Category is required" }, { status: 400 });
      }
      await ensureExpenseCategory(db, businessId, trimmed);
      setUpdate.category = trimmed;
      auditInput.category = trimmed;
    }

    if (note !== undefined) {
      const trimmed = note.trim();
      if (trimmed) setUpdate.note = trimmed;
      else unsetUpdate.note = "";
      auditInput.note = trimmed || null;
    }

    if (approvedBy !== undefined) {
      const trimmed = approvedBy.trim();
      if (trimmed) {
        await ensureApproverName(db, businessId, trimmed);
        setUpdate.approvedBy = trimmed;
        setUpdate.approvedByLower = trimmed.toLowerCase();
        if (existing.approvalStatus === "pending") {
          setUpdate.approvalStatus = "approved";
          setUpdate.approvedAt = new Date();
          setUpdate.paymentStatus = existing.paymentStatus ?? "pending";
          auditInput.approvalStatus = "approved";
        }
      } else {
        unsetUpdate.approvedBy = "";
        unsetUpdate.approvedByLower = "";
        setUpdate.approvalStatus = "pending";
        unsetUpdate.approvedAt = "";
        setUpdate.paymentStatus = "pending";
        auditInput.approvedBy = null;
        auditInput.approvalStatus = "pending";
      }
      auditInput.approvedBy = trimmed || null;
    }

    if (paymentDueDate !== undefined) {
      const trimmed = paymentDueDate.trim();
      if (trimmed) setUpdate.paymentDueDate = trimmed;
      else unsetUpdate.paymentDueDate = "";
      auditInput.paymentDueDate = trimmed || null;
    }

    const changes = buildUpdateAuditChanges(existing as Record<string, unknown>, auditInput);
    if (changes.length === 0) {
      return NextResponse.json(serializeEntry(existing as Record<string, unknown>));
    }

    const editedBy = adminLabel(auth.user as Record<string, unknown>);
    const updateOp: Record<string, unknown> = {
      $set: { ...setUpdate, isEdited: true, editedAt: new Date(), editedBy },
    };
    if (Object.keys(unsetUpdate).length) updateOp.$unset = unsetUpdate;

    await recordEntryAuditLogs(db, {
      entryId: id,
      businessId,
      action: "update",
      changes,
      editedBy,
      reason: reason.trim(),
    });

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), ...NOT_DELETED_MATCH },
      updateOp,
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    invalidateBalanceCache(businessId);

    scheduleSheetsAdjustment(
      db,
      businessId,
      id,
      "update",
      result as Record<string, unknown>,
      existing as Record<string, unknown>,
      reason.trim()
    );

    return NextResponse.json(serializeEntry(result as Record<string, unknown>));
  } catch (error) {
    console.error("Admin entry PATCH error:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
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
    try {
      const body = await request.json();
      reason = body.reason?.trim() ?? "";
    } catch {
      /* empty body */
    }

    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }

    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const collection = db.collection("entries");
    const existing = await collection.findOne({
      _id: new ObjectId(id),
      ...NOT_DELETED_MATCH,
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const businessId = existing.businessId as string;
    const editedBy = adminLabel(auth.user as Record<string, unknown>);
    const snapshot = {
      type: existing.type,
      name: existing.name,
      amount: existing.amount,
      date: existing.date,
      category: existing.category ?? null,
      note: existing.note ?? null,
    };

    await recordEntryAuditLogs(db, {
      entryId: id,
      businessId,
      action: "delete",
      changes: [{ field: "entry", originalValue: snapshot, newValue: null }],
      editedBy,
      reason,
    });

    const deletedAt = new Date();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), ...NOT_DELETED_MATCH },
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

    invalidateBalanceCache(businessId);

    scheduleSheetsAdjustment(
      db,
      businessId,
      id,
      "delete",
      existing as Record<string, unknown>,
      existing as Record<string, unknown>,
      reason
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin entry DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}

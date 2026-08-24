import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { getDb } from "@/lib/mongodb";
import { validatePaymentReference } from "@/lib/paymentReference";
import { markExpensePaymentPaid } from "@/lib/verifyExpensePayment";
import type { PaymentVerifiedMethod } from "@/lib/types";

const MAX_BULK = 50;

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const paymentMethod = body.paymentMethod as PaymentVerifiedMethod;
    const paymentDate = typeof body.paymentDate === "string" ? body.paymentDate.trim() : "";
    const paymentPaidTo = typeof body.paymentPaidTo === "string" ? body.paymentPaidTo.trim() : "";
    const paymentNote = typeof body.paymentNote === "string" ? body.paymentNote.trim() : "";
    const requestedBy = typeof body.requestedBy === "string" ? body.requestedBy.trim() : "";
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string" && ObjectId.isValid(id))
      : [];

    if (!requestedBy && ids.length === 0) {
      return NextResponse.json(
        { error: "Select a Requested by person (or specific entries) before bulk pay" },
        { status: 400 }
      );
    }
    if (
      paymentMethod !== "Cash" &&
      paymentMethod !== "Bank Transfer" &&
      paymentMethod !== "GPay / UPI"
    ) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }
    if (!paymentDate) {
      return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    }

    const referenceCheck = validatePaymentReference(
      paymentMethod,
      typeof body.paymentReference === "string" ? body.paymentReference : ""
    );
    if (!referenceCheck.ok) {
      return NextResponse.json({ error: referenceCheck.error }, { status: 400 });
    }
    const paymentReference = referenceCheck.value;
    const paidTo = paymentMethod === "Cash" ? paymentPaidTo || requestedBy : paymentPaidTo;
    if (paymentMethod === "Cash" && !paidTo) {
      return NextResponse.json({ error: "Paid to is required for cash" }, { status: 400 });
    }

    const match: Record<string, unknown> = {
      type: "expense",
      ...NOT_DELETED_MATCH,
      approvalStatus: "approved",
      paymentStatus: "pending",
    };
    if (businessId) match.businessId = businessId;
    if (requestedBy) match.nameLower = requestedBy.toLowerCase();
    if (from || to) {
      const dateMatch: Record<string, string> = {};
      if (from) dateMatch.$gte = from;
      if (to) dateMatch.$lte = to;
      match.date = dateMatch;
    }
    if (ids.length > 0) {
      match._id = { $in: ids.map((id: string) => new ObjectId(id)) };
    }

    const entries = await db
      .collection("entries")
      .find(match)
      .sort({ date: 1, createdAt: 1 })
      .limit(MAX_BULK + 1)
      .toArray();

    if (entries.length === 0) {
      return NextResponse.json({ error: "No pending payments match this filter" }, { status: 400 });
    }
    if (entries.length > MAX_BULK) {
      return NextResponse.json(
        { error: `Bulk pay is limited to ${MAX_BULK} entries. Narrow the date range.` },
        { status: 400 }
      );
    }

    const adminName =
      (auth.user.name as string) || (auth.user.username as string) || auth.adminId;
    const bulkNote =
      paymentNote ||
      `Bulk paid${requestedBy ? ` — ${requestedBy}` : ""}${from || to ? ` (${from || "…"} to ${to || "…"})` : ""}`;

    let paidCount = 0;
    let paidAmount = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      const result = await markExpensePaymentPaid(db, entry as Record<string, unknown>, adminName, {
        paymentMethod,
        paymentDate,
        paymentReference,
        paymentPaidTo: paidTo,
        paymentNote: bulkNote,
      });
      if (result.ok) {
        paidCount += 1;
        paidAmount += Math.abs(Number(entry.amount) || 0);
      } else {
        errors.push(`${entry.name}: ${result.error}`);
      }
    }

    if (paidCount === 0) {
      return NextResponse.json(
        { error: errors[0] || "Could not mark payments as paid" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      paidCount,
      paidAmount,
      errors,
    });
  } catch (error) {
    console.error("Bulk pay error:", error);
    return NextResponse.json({ error: "Failed to bulk pay" }, { status: 500 });
  }
}

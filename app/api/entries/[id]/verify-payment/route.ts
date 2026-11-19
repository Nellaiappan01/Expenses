import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { getDb } from "@/lib/mongodb";
import { validatePaymentReference } from "@/lib/paymentReference";
import { markExpensePaymentPaid } from "@/lib/verifyExpensePayment";
import type { PaymentVerifiedMethod } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const paymentVerifiedMethod = body.paymentMethod as PaymentVerifiedMethod;
    const paymentDate = body.paymentDate?.trim();
    const paymentPaidTo = body.paymentPaidTo?.trim() || "";
    const paymentNote = body.paymentNote?.trim() || "";

    if (
      paymentVerifiedMethod !== "Cash" &&
      paymentVerifiedMethod !== "Bank Transfer" &&
      paymentVerifiedMethod !== "GPay / UPI"
    ) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }
    if (!paymentDate) {
      return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    }

    const referenceCheck = validatePaymentReference(
      paymentVerifiedMethod,
      typeof body.paymentReference === "string" ? body.paymentReference : ""
    );
    if (!referenceCheck.ok) {
      return NextResponse.json({ error: referenceCheck.error }, { status: 400 });
    }
    const paymentReference = referenceCheck.value;
    if (paymentVerifiedMethod === "Cash" && !paymentPaidTo) {
      return NextResponse.json({ error: "Paid to is required for cash" }, { status: 400 });
    }

    const existing = await db.collection("entries").findOne({
      _id: new ObjectId(id),
      type: "expense",
      ...NOT_DELETED_MATCH,
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const approvalStatus = existing.approvalStatus as string | undefined;
    const isLegacy = !approvalStatus && !existing.paymentStatus;

    if (!isLegacy && approvalStatus !== "approved") {
      return NextResponse.json({ error: "Expense must be approved before payment" }, { status: 400 });
    }
    if (existing.paymentStatus === "paid") {
      return NextResponse.json({ error: "Payment already verified" }, { status: 400 });
    }

    const adminName =
      (auth.user.name as string) || (auth.user.username as string) || auth.adminId;

    const paid = await markExpensePaymentPaid(
      db,
      existing as Record<string, unknown>,
      adminName,
      {
        paymentMethod: paymentVerifiedMethod,
        paymentDate,
        paymentReference,
        paymentPaidTo,
        paymentNote,
      }
    );

    if (!paid.ok) {
      const status = paid.error === "Payment verification failed" ? 500 : 400;
      return NextResponse.json({ error: paid.error }, { status });
    }

    return NextResponse.json(serializeEntry(paid.entry));
  } catch (error) {
    console.error("Verify payment error:", error);
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
  }
}

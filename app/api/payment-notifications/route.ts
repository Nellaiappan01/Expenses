import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import { serializeEntry } from "@/lib/entrySerialize";
import { requestLabel } from "@/lib/paymentWorkflow";

/** Recently verified payments for the current user's dashboard notifications. */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const entries = await db
      .collection("entries")
      .find({
        businessId: userId,
        type: "expense",
        paymentStatus: "paid",
        paymentVerifiedAt: { $gte: since },
        paymentNotificationHidden: { $ne: true },
        deleted: { $ne: true },
      })
      .sort({ paymentVerifiedAt: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      notifications: entries.map((e) => ({
        entryId: e._id.toString(),
        message: `₹${Math.abs(e.amount as number).toLocaleString("en-IN")} for ${requestLabel({
          name: e.name as string,
          category: e.category as string | undefined,
          note: e.note as string | undefined,
        })} has been approved and paid.`,
        verifiedAt:
          e.paymentVerifiedAt instanceof Date
            ? e.paymentVerifiedAt.toISOString()
            : e.paymentVerifiedAt,
        entry: serializeEntry(e),
      })),
    });
  } catch (error) {
    console.error("Payment notifications error:", error);
    return NextResponse.json({ notifications: [] });
  }
}

/** Hide a paid notification after the user taps Dismiss. */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json().catch(() => ({}));
    const entryId = typeof body.entryId === "string" ? body.entryId.trim() : "";
    if (!entryId || !ObjectId.isValid(entryId)) {
      return NextResponse.json({ error: "Invalid entry" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("entries").updateOne(
      {
        _id: new ObjectId(entryId),
        businessId: userId,
        type: "expense",
        deleted: { $ne: true },
      },
      { $set: { paymentNotificationHidden: true } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Dismiss payment notification error:", error);
    return NextResponse.json({ error: "Could not dismiss" }, { status: 500 });
  }
}

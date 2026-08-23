import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { findExpensePerson, normalizeExpensePeople } from "@/lib/expensePeople";
import { getDb } from "@/lib/mongodb";
import type { PaymentStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "payment_pending";
    const businessId = searchParams.get("businessId")?.trim();

    const match: Record<string, unknown> = {
      type: "expense",
      ...NOT_DELETED_MATCH,
    };

    if (businessId) {
      match.businessId = businessId;
    }

    if (filter === "approval_pending") {
      match.approvalStatus = "pending";
    } else if (filter === "payment_pending") {
      match.approvalStatus = "approved";
      match.paymentStatus = "pending";
    } else if (filter === "paid") {
      match.paymentStatus = "paid";
    } else if (filter === "all") {
      match.$or = [
        { approvalStatus: { $in: ["pending", "approved"] } },
        { paymentStatus: { $in: ["pending", "paid"] } },
        { approvalStatus: { $exists: false }, paymentStatus: { $exists: false } },
      ];
    }

    const entries = await db
      .collection("entries")
      .find(match)
      .sort({ approvedAt: -1, createdAt: -1 })
      .limit(200)
      .toArray();

    const baseMatch = { type: "expense", ...NOT_DELETED_MATCH };
    const [approvalPending, paymentPending, paidCount] = await Promise.all([
      db.collection("entries").countDocuments({ ...baseMatch, approvalStatus: "pending" }),
      db.collection("entries").countDocuments({
        ...baseMatch,
        approvalStatus: "approved",
        paymentStatus: "pending",
      }),
      db.collection("entries").countDocuments({ ...baseMatch, paymentStatus: "paid" }),
    ]);

    const users = await db
      .collection("users")
      .find({})
      .project({ userId: 1, name: 1, username: 1 })
      .toArray();

    const userNames = Object.fromEntries(
      users.map((u) => [u.userId, u.name || u.username || u.userId])
    );

    const businessIds = [...new Set(entries.map((e) => e.businessId as string))];
    const defaultsDocs = await db
      .collection("defaults")
      .find({ businessId: { $in: businessIds } })
      .toArray();
    const peopleByBusiness = Object.fromEntries(
      defaultsDocs.map((doc) => [
        doc.businessId as string,
        normalizeExpensePeople(doc as Parameters<typeof normalizeExpensePeople>[0]),
      ])
    );

    return NextResponse.json({
      entries: entries.map((e) => {
        const businessId = e.businessId as string;
        const payee = findExpensePerson(peopleByBusiness[businessId], e.name as string);
        return serializeEntry({
          ...e,
          businessName: userNames[businessId] ?? businessId,
          payee,
        });
      }),
      users: users.map((u) => ({
        userId: u.userId,
        name: u.name || u.username || u.userId,
      })),
      counts: {
        approvalPending,
        paymentPending,
        paid: paidCount,
      },
    });
  } catch (error) {
    console.error("Admin payments GET error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}

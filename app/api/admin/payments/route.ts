import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { findExpensePerson, normalizeExpensePeople } from "@/lib/expensePeople";
import { healNamedApprovals } from "@/lib/healNamedApprovals";
import { getDb } from "@/lib/mongodb";
import { AWAITING_APPROVER_MATCH, AWAITING_PAYMENT_MATCH } from "@/lib/paymentWorkflow";

function applyScope(
  match: Record<string, unknown>,
  scope: { businessId?: string; requestedBy?: string; from?: string; to?: string }
) {
  if (scope.businessId) match.businessId = scope.businessId;
  if (scope.requestedBy) match.nameLower = scope.requestedBy.toLowerCase();
  if (scope.from || scope.to) {
    const dateMatch: Record<string, string> = {};
    if (scope.from) dateMatch.$gte = scope.from;
    if (scope.to) dateMatch.$lte = scope.to;
    match.date = dateMatch;
  }
  return match;
}

async function sumAmount(db: Awaited<ReturnType<typeof getDb>>, match: Record<string, unknown>) {
  const row = await db
    .collection("entries")
    .aggregate<{ count: number; amount: number }>([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: { $abs: "$amount" } },
        },
      },
    ])
    .toArray();
  return row[0] ?? { count: 0, amount: 0 };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const auth = await requireAdmin(db, request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    await healNamedApprovals(db, searchParams.get("businessId")?.trim() || undefined);

    const filter = searchParams.get("filter") ?? "payment_pending";
    const scope = {
      businessId: searchParams.get("businessId")?.trim() || undefined,
      requestedBy: searchParams.get("requestedBy")?.trim() || undefined,
      from: searchParams.get("from")?.trim() || undefined,
      to: searchParams.get("to")?.trim() || undefined,
    };

    const listMatch: Record<string, unknown> = {
      type: "expense",
      ...NOT_DELETED_MATCH,
    };
    applyScope(listMatch, scope);

    if (filter === "approval_pending") {
      Object.assign(listMatch, AWAITING_APPROVER_MATCH);
    } else if (filter === "payment_pending") {
      Object.assign(listMatch, AWAITING_PAYMENT_MATCH);
    } else if (filter === "paid") {
      listMatch.paymentStatus = "paid";
    } else if (filter === "all") {
      listMatch.$or = [
        { approvalStatus: { $in: ["pending", "approved"] } },
        { paymentStatus: { $in: ["pending", "paid"] } },
        { approvalStatus: { $exists: false }, paymentStatus: { $exists: false } },
      ];
    }

    const approvalMatch = applyScope(
      { ...NOT_DELETED_MATCH, ...AWAITING_APPROVER_MATCH },
      scope
    );
    const paymentMatch = applyScope(
      { ...NOT_DELETED_MATCH, ...AWAITING_PAYMENT_MATCH },
      scope
    );
    const paidMatch = applyScope(
      { type: "expense", ...NOT_DELETED_MATCH, paymentStatus: "paid" },
      scope
    );

    const entries = await db
      .collection("entries")
      .find(listMatch)
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .toArray();

    const [approvalTotal, pendingTotal, paidTotal, filteredTotal, requestedByRows] =
      await Promise.all([
        sumAmount(db, approvalMatch),
        sumAmount(db, paymentMatch),
        sumAmount(db, paidMatch),
        sumAmount(db, listMatch),
        db
          .collection("entries")
          .aggregate<{ name: string }>([
            { $match: { type: "expense", ...NOT_DELETED_MATCH } },
            { $group: { _id: "$nameLower", name: { $first: "$name" } } },
            { $sort: { name: 1 } },
          ])
          .toArray(),
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
      requestedByNames: requestedByRows.map((row) => row.name).filter(Boolean),
      pendingTotal,
      paidTotal,
      approvalTotal,
      filteredTotal,
      counts: {
        approvalPending: approvalTotal.count,
        paymentPending: pendingTotal.count,
        paid: paidTotal.count,
      },
    });
  } catch (error) {
    console.error("Admin payments GET error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}

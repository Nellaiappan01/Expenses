import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { NOT_DELETED_MATCH } from "@/lib/entryAudit";
import { serializeEntry } from "@/lib/entrySerialize";
import { expenseNamesFromPeople, findExpensePerson, normalizeExpensePeople } from "@/lib/expensePeople";
import { healNamedApprovals } from "@/lib/healNamedApprovals";
import { getDb } from "@/lib/mongodb";
import { AWAITING_APPROVER_MATCH, AWAITING_PAYMENT_MATCH } from "@/lib/paymentWorkflow";

function applyScope(
  match: Record<string, unknown>,
  scope: {
    businessId?: string;
    requestedBy?: string;
    category?: string;
    from?: string;
    to?: string;
  }
) {
  if (scope.businessId) match.businessId = scope.businessId;
  if (scope.requestedBy) match.nameLower = scope.requestedBy.toLowerCase();
  if (scope.category) {
    const escaped = scope.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    match.category = { $regex: `^${escaped}$`, $options: "i" };
  }
  if (scope.from || scope.to) {
    const dateMatch: Record<string, string> = {};
    if (scope.from) dateMatch.$gte = scope.from;
    if (scope.to) dateMatch.$lte = scope.to;
    match.date = dateMatch;
  }
  return match;
}

async function distinctEntryValues(
  db: Awaited<ReturnType<typeof getDb>>,
  businessId: string,
  field: "name" | "category",
  filters?: { category?: string; requestedBy?: string }
): Promise<string[]> {
  const match: Record<string, unknown> = {
    type: "expense",
    ...NOT_DELETED_MATCH,
    businessId,
  };
  if (filters?.category) {
    const escaped = filters.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    match.category = { $regex: `^${escaped}$`, $options: "i" };
  }
  if (filters?.requestedBy) {
    match.nameLower = filters.requestedBy.toLowerCase();
  }

  const fieldKey = field === "name" ? "name" : "category";
  const rows = await db
    .collection("entries")
    .aggregate<{ value: string }>([
      { $match: { ...match, [fieldKey]: { $exists: true, $nin: ["", null] } } },
      {
        $group: {
          _id: field === "name" ? "$nameLower" : { $toLower: `$${fieldKey}` },
          value: { $first: `$${fieldKey}` },
        },
      },
      { $sort: { value: 1 } },
    ])
    .toArray();

  return rows.map((row) => String(row.value).trim()).filter(Boolean);
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
      category: searchParams.get("category")?.trim() || undefined,
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

    const [approvalTotal, pendingTotal, paidTotal, filteredTotal] = await Promise.all([
      sumAmount(db, approvalMatch),
      sumAmount(db, paymentMatch),
      sumAmount(db, paidMatch),
      sumAmount(db, listMatch),
    ]);

    const users = await db
      .collection("users")
      .find({})
      .project({ userId: 1, name: 1, username: 1 })
      .toArray();

    const userNames = Object.fromEntries(
      users.map((u) => [u.userId, u.name || u.username || u.userId])
    );

    const defaultsDocs = await db
      .collection("defaults")
      .find(scope.businessId ? { businessId: scope.businessId } : {})
      .toArray();
    const peopleByBusiness = Object.fromEntries(
      defaultsDocs.map((doc) => [
        doc.businessId as string,
        normalizeExpensePeople(doc as Parameters<typeof normalizeExpensePeople>[0]),
      ])
    );

    let requestedByNames: string[] = [];
    let categoryNames: string[] = [];

    if (scope.businessId) {
      const doc = defaultsDocs.find((d) => d.businessId === scope.businessId);
      const defaultPeople = expenseNamesFromPeople(peopleByBusiness[scope.businessId] ?? []);
      const defaultCategories = new Set<string>();
      for (const cat of (doc?.expenseCategories as string[] | undefined) ?? []) {
        const trimmed = String(cat).trim();
        if (trimmed) defaultCategories.add(trimmed);
      }

      const [namesFromEntries, categoriesFromEntries] = await Promise.all([
        distinctEntryValues(db, scope.businessId, "name", {
          category: scope.category,
          requestedBy: scope.requestedBy,
        }),
        distinctEntryValues(db, scope.businessId, "category", {
          category: scope.category,
          requestedBy: scope.requestedBy,
        }),
      ]);

      if (scope.category) {
        requestedByNames = namesFromEntries;
      } else if (scope.requestedBy) {
        requestedByNames = defaultPeople.filter(
          (name) => name.toLowerCase() === scope.requestedBy!.toLowerCase()
        );
      } else {
        requestedByNames = defaultPeople;
      }

      if (scope.requestedBy) {
        const defaultByLower = new Map(
          [...defaultCategories].map((cat) => [cat.toLowerCase(), cat] as const)
        );
        categoryNames = categoriesFromEntries
          .map((cat) => defaultByLower.get(cat.toLowerCase()) ?? cat)
          .filter((cat, index, list) => list.indexOf(cat) === index)
          .sort((a, b) => a.localeCompare(b));
      } else if (scope.category) {
        categoryNames = [...defaultCategories].filter(
          (cat) => cat.toLowerCase() === scope.category!.toLowerCase()
        );
        if (categoryNames.length === 0) {
          categoryNames = [scope.category];
        }
      } else {
        categoryNames = [...defaultCategories].sort((a, b) => a.localeCompare(b));
      }
    }

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
      requestedByNames,
      categoryNames,
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

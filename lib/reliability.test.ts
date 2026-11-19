import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ObjectId, type Db } from "mongodb";
import { chainFromAnchor, entryEffectRupees, sheetStatusCountsExpense } from "./ledgerMath";
import { formatSheetPaymentStatus } from "./paymentWorkflow";
import {
  buildSheetUpsertPayload,
  buildSheetsPayload,
  buildSheetsSyncQueueFilter,
  interpretSheetsResponse,
  sheetsTransportFailure,
} from "./googleSheetsSync";
import { markExpensePaymentPaid } from "./verifyExpensePayment";
import type { Entry } from "./types";

function httpResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/json" } });
}

test("empty HTTP 200 is not a successful sheet sync", () => {
  const result = interpretSheetsResponse(httpResponse(200, ""), "");
  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
});

test("invalid JSON is not a successful sheet sync", () => {
  const result = interpretSheetsResponse(httpResponse(200, "{not json"), "{not json");
  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
});

test("HTML response is not a successful sheet sync", () => {
  const result = interpretSheetsResponse(httpResponse(200, "<html>ok</html>"), "<html>ok</html>");
  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
});

test("health response without an action is not a successful sheet sync", () => {
  const body = JSON.stringify({
    ok: true,
    message: "Site Ledger webhook is running",
    scriptVersion: "2026-11-19c",
  });
  const result = interpretSheetsResponse(httpResponse(200, body), body);
  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
});

test("Google Drive HTML page is not a successful sheet sync", () => {
  const body = "<!DOCTYPE html><html><body>Sorry, unable to open the file at this time.</body></html>";
  const result = interpretSheetsResponse(httpResponse(404, body), body);
  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
  assert.match(result.error || "", /HTML/);
  assert.ok((result.error || "").length < 200);
});

test("valid append response is a successful sheet sync", () => {
  const body = JSON.stringify({ ok: true, action: "append", row: 3 });
  const result = interpretSheetsResponse(httpResponse(200, body), body);
  assert.equal(result.ok, true);
  assert.equal(result.status, "synced");
});

test("timeout stays pending so the same entry can be retried", () => {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  const result = sheetsTransportFailure(error);
  assert.equal(result.ok, false);
  assert.equal(result.status, "pending");
  assert.equal(result.timedOut, true);

  const filter = buildSheetsSyncQueueFilter("site-1");
  assert.deepEqual(filter.sheetsSyncStatus, { $in: ["pending", "failed"] });
  assert.equal(JSON.stringify(filter).includes("sheetsSyncedAt"), false);
});

test("pending unpaid expense is included in Sync All", () => {
  const filter = buildSheetsSyncQueueFilter("site-1", "pending");
  const nor = (filter.$nor as Array<Record<string, unknown>> | undefined) ?? [];
  const expense = {
    type: "expense",
    paymentStatus: "pending",
    sheetsSyncStatus: "pending",
    isNil: false,
  };
  const paid = {
    type: "expense",
    paymentStatus: "paid",
    sheetsSyncStatus: "pending",
    isNil: false,
  };
  const matches = (row: Record<string, unknown>) =>
    nor.some((clause) =>
      Object.entries(clause).every(([key, expected]) => {
        if (expected && typeof expected === "object" && "$ne" in (expected as object)) {
          return row[key] !== (expected as { $ne: unknown }).$ne;
        }
        return row[key] === expected;
      })
    );
  assert.equal(matches(expense), false);
  assert.equal(matches(paid), false);
});

test("retry keeps the same Entry ID and asks for an update", () => {
  const entryId = "64b7f3c2a1d4e5f678901234";
  const entry = {
    type: "expense",
    date: "2026-11-19",
    name: "Ravi",
    category: "Diesel",
    amount: 500,
    method: "Cash",
    note: "",
    paymentStatus: "pending",
    approvalStatus: "approved",
  };
  const first = buildSheetUpsertPayload(entryId, entry);
  const retry = buildSheetUpsertPayload(entryId, entry);
  assert.equal(first.action, "update");
  assert.equal(retry.action, "update");
  assert.equal(first.entryId, entryId);
  assert.equal(retry.entryId, entryId);
});

test("payment stays saved when Google Sheets sync fails", async () => {
  const previous = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const order: string[] = [];
  const id = new ObjectId();
  let stored: Record<string, unknown> | null = {
    _id: id,
    type: "expense",
    businessId: "site-1",
    amount: 250,
    approvalStatus: "approved",
    paymentStatus: "pending",
    deleted: false,
  };

  const db = {
    collection(name: string) {
      return {
        async findOne() {
          order.push(`find:${name}`);
          return stored;
        },
        async findOneAndUpdate(filter: { paymentStatus?: { $ne?: string } }) {
          order.push("update");
          if (!stored || stored.paymentStatus === filter.paymentStatus?.$ne) return null;
          stored = { ...stored, paymentStatus: "paid", paymentVerifiedMethod: "Cash" };
          return stored;
        },
        async insertMany() {
          order.push("audit");
          return { insertedCount: 4 };
        },
        async updateOne() {
          order.push("sync-status");
          return { modifiedCount: 1 };
        },
      };
    },
  };

  try {
    const result = await markExpensePaymentPaid(db as unknown as Db, stored, "Admin", {
      paymentMethod: "Cash",
      paymentDate: "2026-11-19",
      paymentReference: "",
      paymentPaidTo: "Ravi",
      paymentNote: "Cash paid",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.entry.paymentStatus, "paid");
      assert.equal(result.entry.sheetsSyncStatus, "failed");
    }
    assert.ok(order.indexOf("update") < order.indexOf("audit"));
    assert.equal(stored?.paymentStatus, "paid");
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    else process.env.GOOGLE_SHEETS_WEBHOOK_URL = previous;
  }
});

test("a second payment verification does not change the paid entry", async () => {
  const id = new ObjectId();
  const stored: Record<string, unknown> = {
    _id: id,
    type: "expense",
    businessId: "site-1",
    amount: 250,
    approvalStatus: "approved",
    paymentStatus: "paid",
    deleted: false,
  };
  let audits = 0;
  const db = {
    collection() {
      return {
        async findOne() {
          return stored;
        },
        async findOneAndUpdate() {
          return null;
        },
        async insertMany() {
          audits += 1;
          return { insertedCount: 1 };
        },
        async updateOne() {
          return { modifiedCount: 0 };
        },
      };
    },
  };

  const result = await markExpensePaymentPaid(db as unknown as Db, stored, "Admin", {
    paymentMethod: "Cash",
    paymentDate: "2026-11-19",
    paymentReference: "",
    paymentPaidTo: "Ravi",
    paymentNote: "",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Payment already verified");
  assert.equal(audits, 0);
  assert.equal(stored.amount, 250);
  assert.equal(stored.paymentStatus, "paid");
});

test("saved payment record reports paid independently of sheet status", async () => {
  const previous = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const id = new ObjectId();
  const stored: Record<string, unknown> = {
    _id: id,
    type: "expense",
    businessId: "site-1",
    amount: 80,
    approvalStatus: "approved",
    paymentStatus: "pending",
  };
  const db = {
    collection() {
      return {
        async findOne() {
          return stored;
        },
        async findOneAndUpdate() {
          stored.paymentStatus = "paid";
          return stored;
        },
        async insertMany() {
          return { insertedCount: 1 };
        },
        async updateOne() {
          return { modifiedCount: 1 };
        },
      };
    },
  };
  try {
    const result = await markExpensePaymentPaid(db as unknown as Db, { ...stored, paymentStatus: "pending" }, "Admin", {
      paymentMethod: "GPay / UPI",
      paymentDate: "2026-11-19",
      paymentReference: "UPI123",
      paymentPaidTo: "",
      paymentNote: "",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.entry.paymentStatus, "paid");
      assert.notEqual(result.entry.sheetsSyncStatus, "synced");
    }
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    else process.env.GOOGLE_SHEETS_WEBHOOK_URL = previous;
  }
});

test("wallet add and withdraw and expense statuses move the closing balance once", () => {
  const movements: Entry[] = [
    expenseLike("rotation_cash", 1000),
    expenseLike("expense", 100, { approvalStatus: "pending", paymentStatus: "pending" }),
    expenseLike("expense", 200, { approvalStatus: "approved", paymentStatus: "pending" }),
    expenseLike("expense", 50, { approvalStatus: "rejected", paymentStatus: "pending" }),
    expenseLike("expense", 10, { paymentStatus: "paid", isNil: true }),
    expenseLike("expense", 300, { approvalStatus: "approved", paymentStatus: "paid" }),
    expenseLike("rotation_cash", -40),
  ];

  let website = 0;
  const sheetRows = movements.map((entry) => {
    website += entryEffectRupees(entry);
    const payload = buildSheetsPayload({
      type: entry.type,
      date: entry.date,
      name: entry.name,
      category: entry.category,
      amount: entry.amount,
      method: entry.method,
      note: entry.note,
      approvalStatus: entry.approvalStatus,
      paymentStatus: entry.paymentStatus,
      isNil: entry.isNil,
    });
    return {
      expensePaise: Math.round((payload.expenseAmount || 0) * 100),
      addonPaise: Math.round((payload.addOn || 0) * 100),
      countsExpense: sheetStatusCountsExpense(payload.paymentStatus || ""),
    };
  });

  const sheet = chainFromAnchor(0, sheetRows);
  const sheetClosing = sheet[sheet.length - 1].closingPaise / 100;
  assert.equal(website, 660);
  assert.equal(sheetClosing, 660);
  assert.equal(buildSheetsPayload({
    type: "rotation_cash",
    date: "2026-11-19",
    name: "Wallet Add",
    amount: 1000,
    method: "Cash",
  }).addOn, 1000);
  assert.equal(buildSheetsPayload({
    type: "rotation_cash",
    date: "2026-11-19",
    name: "Wallet Withdraw",
    amount: -40,
    method: "Cash",
  }).expenseAmount, 40);
});

test("Apps Script source matches the website balance rules and version 2026-11-19c", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "google-sheets-apps-script.gs"), "utf8");
  assert.match(source, /Version:\s*2026-11-19c/);
  assert.match(source, /scriptVersion:\s*"2026-11-19c"/);
  assert.match(source, /obj\.scriptVersion = "2026-11-19c"/);
  assert.match(source, /found\.open\[found\.open\.length - 1\]/);
  assert.match(source, /function findEntryMatches_/);
  assert.match(source, /isClosedLedgerHeader_\(m1\)/);
  assert.match(
    source,
    /if \(s === "Rejected" \|\| s === "Pending Approval" \|\| s === "Payment Pending" \|\| s === "Nil"\)/
  );
  assert.match(source, /if \(!s\) return true;/);

  for (const label of ["Paid / Verified", "Payment Pending", "Pending Approval", "Rejected", "Nil", ""]) {
    const counts = sheetStatusCountsExpense(label);
    if (label === "Paid / Verified" || label === "") assert.equal(counts, true);
    else assert.equal(counts, false);
  }

  assert.equal(
    formatSheetPaymentStatus({ type: "expense", approvalStatus: "pending", paymentStatus: "pending" }),
    "Pending Approval"
  );
  assert.equal(
    formatSheetPaymentStatus({
      type: "expense",
      approvalStatus: "approved",
      paymentStatus: "pending",
      approvedBy: "Meena",
    }),
    "Payment Pending"
  );
});

function expenseLike(
  type: Entry["type"],
  amount: number,
  extra: Partial<Entry> = {}
): Entry {
  return {
    type,
    name: type === "rotation_cash" ? "Wallet" : "Ravi",
    nameLower: "ravi",
    amount,
    method: "Cash",
    date: "2026-11-19",
    category: type === "expense" ? "Diesel" : undefined,
    businessId: "site-1",
    createdAt: new Date("2026-11-19T00:00:00Z"),
    ...extra,
  };
}

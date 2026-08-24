import type { ExpensePerson, ExpensePersonPreferredMethod } from "./types";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMethod(value: unknown): ExpensePersonPreferredMethod {
  if (value === "gpay" || value === "bank" || value === "cash") return value;
  return "cash";
}

export function sanitizeExpensePerson(raw: Partial<ExpensePerson>): ExpensePerson | null {
  const name = cleanText(raw.name);
  if (!name) return null;
  const preferredMethod = normalizeMethod(raw.preferredMethod);
  return {
    name,
    nameLower: name.toLowerCase(),
    preferredMethod,
    cashOk: preferredMethod === "cash" ? true : Boolean(raw.cashOk),
    upiId: cleanText(raw.upiId) || undefined,
    bankAccount: cleanText(raw.bankAccount) || undefined,
    ifsc: cleanText(raw.ifsc).toUpperCase() || undefined,
    accountHolder: cleanText(raw.accountHolder) || undefined,
  };
}

export function normalizeExpensePeople(
  doc: { expensePeople?: Partial<ExpensePerson>[]; expenseNames?: string[]; names?: string[] } | null | undefined
): ExpensePerson[] {
  if (doc?.expensePeople?.length) {
    const seen = new Set<string>();
    const people: ExpensePerson[] = [];
    for (const raw of doc.expensePeople) {
      const person = sanitizeExpensePerson(raw);
      if (!person || seen.has(person.nameLower)) continue;
      seen.add(person.nameLower);
      people.push(person);
    }
    return people;
  }

  const legacyNames = doc?.expenseNames ?? doc?.names ?? [];
  return legacyNames
    .map((name) => sanitizeExpensePerson({ name, preferredMethod: "cash", cashOk: true }))
    .filter((p): p is ExpensePerson => Boolean(p));
}

export function expenseNamesFromPeople(people: ExpensePerson[]): string[] {
  return people.map((p) => p.name);
}

export function findExpensePerson(
  people: ExpensePerson[] | undefined,
  name: string | undefined
): ExpensePerson | undefined {
  if (!people?.length || !name?.trim()) return undefined;
  const key = name.trim().toLowerCase();
  return people.find((p) => p.nameLower === key);
}

/** Personal VPA charset used by NPCI (do not percent-encode `@`). */
const PERSONAL_VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9._-]{2,64}$/;

export function isValidUpiId(upiId: string): boolean {
  return PERSONAL_VPA.test(upiId.trim());
}

/**
 * P2P UPI deep link (not a merchant checkout).
 *
 * Intentionally omits `mc` (merchant code) and `tr` (merchant order id). Those
 * mark the payment as P2M. GPay/NPCI reject or mis-limit intent payments to
 * personal VPAs; faking merchant fields does not make a personal @oksbi ID a
 * registered merchant.
 *
 * `pa` is left unencoded so GPay receives `name@bank` rather than `name%40bank`.
 */
export function buildUpiPayUrl(params: {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
}): string | null {
  const pa = params.upiId.trim();
  if (!isValidUpiId(pa)) return null;
  const pn = encodeURIComponent(params.name.trim() || "Payee");
  const am = Math.abs(params.amount).toFixed(2);
  const note = params.note?.trim().replace(/\s+/g, " ").slice(0, 50);
  const tn = note ? `&tn=${encodeURIComponent(note)}` : "";
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR${tn}`;
}

export function formatBankDetailsText(person: ExpensePerson): string {
  const lines = [
    person.accountHolder ? `Name: ${person.accountHolder}` : null,
    person.bankAccount ? `Account: ${person.bankAccount}` : null,
    person.ifsc ? `IFSC: ${person.ifsc}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function paymentMethodFromPerson(
  person: ExpensePerson | undefined
): "Cash" | "Bank Transfer" | "GPay / UPI" {
  if (!person) return "Bank Transfer";
  if (person.preferredMethod === "gpay" && person.upiId) return "GPay / UPI";
  if (person.preferredMethod === "bank") return "Bank Transfer";
  if (person.preferredMethod === "cash") return "Cash";
  if (person.upiId) return "GPay / UPI";
  if (person.bankAccount && person.ifsc) return "Bank Transfer";
  return "Cash";
}

export function expensePersonPaymentSummary(person: ExpensePerson): {
  methodLabel: string;
  verified: boolean;
  verifiedLabel: string;
} {
  const method = person.preferredMethod ?? "cash";
  if (method === "gpay") {
    const verified = Boolean(person.upiId?.trim());
    return {
      methodLabel: "GPay",
      verified,
      verifiedLabel: verified ? "UPI verified" : "Add UPI ID",
    };
  }
  if (method === "bank") {
    const verified = Boolean(person.bankAccount?.trim() && person.ifsc?.trim());
    return {
      methodLabel: "Bank",
      verified,
      verifiedLabel: verified ? "Bank verified" : "Add bank details",
    };
  }
  return {
    methodLabel: "Cash",
    verified: true,
    verifiedLabel: "Cash OK",
  };
}

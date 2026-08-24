/** Words that must never be stored as a UPI/UTR reference. */
const PLACEHOLDER_REFERENCES = new Set([
  "paid",
  "pay",
  "success",
  "successful",
  "successfully",
  "done",
  "ok",
  "okay",
  "yes",
  "verified",
  "verify",
  "complete",
  "completed",
  "received",
  "payment",
  "gpay",
  "upi",
  "cash",
  "bank",
  "test",
  "na",
  "n/a",
  "pending",
  "failed",
  "fail",
  "pass",
  "passed",
  "confirm",
  "confirmed",
  "transfer",
  "transferred",
  "sent",
  "txn",
  "utr",
  "id",
]);

export function normalizePaymentReference(raw: string): string {
  return raw.trim().replace(/[\s-]/g, "");
}

function isPlaceholderReference(raw: string, normalized: string): boolean {
  const original = raw.trim().toLowerCase();
  const compact = normalized.toLowerCase();
  return PLACEHOLDER_REFERENCES.has(original) || PLACEHOLDER_REFERENCES.has(compact);
}

function looksLikeBankOrUpiId(
  value: string,
  label: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (!/^[A-Za-z0-9]+$/.test(value)) {
    return {
      ok: false,
      error: `${label} must be letters and numbers only (copy it from the bank / GPay receipt).`,
    };
  }
  if (value.length < 12 || value.length > 22) {
    return {
      ok: false,
      error: `${label} is usually 12 digits (sometimes 12–22 characters). “Paid” and similar words are not valid.`,
    };
  }
  const digitCount = (value.match(/\d/g) ?? []).length;
  if (digitCount < 8 || digitCount / value.length < 0.5) {
    return {
      ok: false,
      error: `That does not look like a real ${label}. Paste the transaction ID / UTR from the receipt.`,
    };
  }
  return { ok: true, value };
}

export function validateUpiTransactionId(
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) {
    return { ok: false, error: "Enter a short GPay note (GPay has no copy ID)." };
  }
  if (value.length < 2) {
    return { ok: false, error: "GPay note is too short." };
  }
  if (value.length > 80) {
    return { ok: false, error: "GPay note is too long (max 80 characters)." };
  }
  return { ok: true, value };
}

export function validateBankUtr(
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizePaymentReference(raw);
  if (!value) {
    return { ok: false, error: "Enter the UTR / bank reference from the transfer receipt." };
  }
  if (isPlaceholderReference(raw, value)) {
    return {
      ok: false,
      error: "Enter the real UTR from the bank, not a status word like “Paid”.",
    };
  }
  return looksLikeBankOrUpiId(value, "UTR / bank reference");
}

export function validatePaymentReference(
  method: "GPay / UPI" | "Bank Transfer" | "Cash" | string,
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (method === "Cash") return { ok: true, value: "" };
  const methodText = String(method);
  if (
    method === "GPay / UPI" ||
    methodText.includes("GPay") ||
    methodText.includes("UPI")
  ) {
    return validateUpiTransactionId(raw);
  }
  return validateBankUtr(raw);
}
